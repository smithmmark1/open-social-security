import {Injectable} from '@angular/core'
import {BenefitService} from './benefit.service'
import {MortalityService} from './mortality.service'
import {EarningsTestService} from './earningstest.service'
import {SolutionSetService} from './solutionset.service'
import {SolutionSet} from './data model classes/solutionset'
import {Person} from './data model classes/person'
import {ClaimingScenario} from './data model classes/claimingscenario'
import {CalculationYear} from './data model classes/calculationyear'


@Injectable()
export class PresentValueService {

  constructor(private benefitService: BenefitService, private mortalityService:MortalityService, private earningsTestService: EarningsTestService, private solutionSetService: SolutionSetService) { }
  
  //Has maximize calc been run?
  maximizedOrNot: boolean = false

  today: Date = new Date()

  calculateSinglePersonPV(person:Person, scenario:ClaimingScenario, debugTable:boolean)
  {
    person.initialRetirementBenefit = this.benefitService.calculateRetirementBenefit(person, person.retirementBenefitDate)
    let retirementPV: number = 0
    let probabilityAlive: number
    let earningsTestResult:any[] 
    //reset values for new PV calc
        person.hasHadGraceYear = false
        person.adjustedRetirementBenefitDate = new Date(person.retirementBenefitDate)
        person.retirementBenefitWithDRCsfromSuspension = 0
        person.DRCsViaSuspension = 0
        scenario.debugTable = []

    //Set initial calcYear (Jan 1 of the year they turn 62)
    let calcYear:CalculationYear = new CalculationYear(scenario.initialCalcDate)

    //calculate age as of that date
    person.age = ( 12 * (calcYear.date.getFullYear() - person.SSbirthDate.getFullYear()) + (calcYear.date.getMonth()) - person.SSbirthDate.getMonth()  )/12

    //Calculate PV via loop until they hit age 115 (by which point "remaining lives" is zero)
      while (person.age < 115) {

        //Count number of months of each type of retirement benefit (i.e., initial benefit, benefit after ARF, benefit with DRC from suspension)
          calcYear = this.benefitService.CountSingleBenefitMonths(calcYear, person)
      
        //Earnings test
        if (earningsTestResult === undefined || calcYear.date.getFullYear() <= person.FRA.getFullYear()){//Only have to run earnings test if it's before FRA or if it has never been run (has to be run once for after-ARF values to be calc'd)
          earningsTestResult = this.earningsTestService.earningsTestSingle(calcYear, person)
          calcYear = earningsTestResult[0]
          person = earningsTestResult[1]
        }
        
        //Calculate retirementBenefit with DRCs from suspension. (Only have to do it once. But can't do it until a) final adjustedRetirementBenefitDate is known from earnings test and b) number of DRCs is known.)
        if (person.retirementBenefitWithDRCsfromSuspension == 0 && calcYear.date.getFullYear() >= person.FRA.getFullYear() && calcYear.date.getFullYear() >= person.endSuspensionDate.getFullYear()) {
          person.retirementBenefitWithDRCsfromSuspension = this.benefitService.calculateRetirementBenefit(person, person.adjustedRetirementBenefitDate)
        }

        //Calculate annual benefit (including withholding for earnings test and including Adjustment Reduction Factor, but before probability-weighting and discounting)
        calcYear = this.benefitService.calculateAnnualRetirementBenefit(person, calcYear)
        if (debugTable === true) {scenario.debugTable.push([calcYear.date.getFullYear(), calcYear.personAannualRetirementBenefit])}

        //Calculate probability of being alive at end of age in question
        probabilityAlive = this.mortalityService.calculateProbabilityAlive(person, person.age)

        //Calculate probability-weighted benefit
        let annualPV = calcYear.personAannualRetirementBenefit * probabilityAlive

        //Discount that benefit to age 62
        annualPV = annualPV / (1 + scenario.discountRate/100/2) //e.g., benefits received during age 62 must be discounted for 0.5 years
        annualPV = annualPV / Math.pow((1 + scenario.discountRate/100),(person.age - 62)) //e.g., benefits received during age 63 must be discounted for 1.5 years

        //Add discounted benefit to ongoing count of retirementPV, add 1 year to age and calculationYear, and start loop over
        retirementPV = retirementPV + annualPV
        person.age = person.age + 1
        let newCalcDate:Date = new Date(calcYear.date.getFullYear()+1, 0, 1)
        calcYear = new CalculationYear(newCalcDate)
      }

    return retirementPV
  }

  calculateCouplePV(personA:Person, personB:Person, scenario:ClaimingScenario, debugTable:boolean){
    
    //Assorted variables
    let probabilityAalive: number
    let probabilityBalive: number
    let couplePV: number = 0
    let earningsTestResult:any[]

    //reset values for new PV calc
        personA.hasHadGraceYear = false
        personB.hasHadGraceYear = false
        personA.adjustedRetirementBenefitDate = new Date(personA.retirementBenefitDate)
        personA.adjustedSpousalBenefitDate = new Date(personA.spousalBenefitDate)
        personB.adjustedRetirementBenefitDate = new Date(personB.retirementBenefitDate)
        personB.adjustedSpousalBenefitDate = new Date(personB.spousalBenefitDate)
        personA.retirementBenefitWithDRCsfromSuspension = 0
        personA.spousalBenefitWithSuspensionDRCRetirement = 0
        personA.survivorBenefitWithSuspensionDRCRetirement = 0
        personA.DRCsViaSuspension = 0
        personB.retirementBenefitWithDRCsfromSuspension = 0
        personB.DRCsViaSuspension = 0
        personB.spousalBenefitWithSuspensionDRCRetirement = 0
        personB.survivorBenefitWithSuspensionDRCRetirement = 0
        scenario.debugTable = []


    //Find Jan 1 of the year containing initialCalcDate (year in which first spouse reaches age 62, unless divorced in which case it's year in which user turns 62)
    let calcYear:CalculationYear = new CalculationYear(scenario.initialCalcDate)

    //Find age of each spouse as of that Jan 1
    personA.age = ( calcYear.date.getMonth() - personA.SSbirthDate.getMonth() + 12 * (calcYear.date.getFullYear() - personA.SSbirthDate.getFullYear()) )/12
    personB.age = ( calcYear.date.getMonth() - personB.SSbirthDate.getMonth() + 12 * (calcYear.date.getFullYear() - personB.SSbirthDate.getFullYear()) )/12


    //Calculate monthly benefit amounts, pre-ARF
    personA.initialRetirementBenefit = this.benefitService.calculateRetirementBenefit(personA, personA.retirementBenefitDate)
    personB.initialRetirementBenefit = this.benefitService.calculateRetirementBenefit(personB, personB.retirementBenefitDate)
    personA.spousalBenefitWithoutRetirement = this.benefitService.calculateSpousalBenefit(personA, personB, 0, personA.spousalBenefitDate)
    personA.spousalBenefitWithRetirementPreARF = this.benefitService.calculateSpousalBenefit(personA, personB, personA.initialRetirementBenefit, personA.spousalBenefitDate)
    personB.spousalBenefitWithoutRetirement = this.benefitService.calculateSpousalBenefit(personB, personA, 0, personB.spousalBenefitDate)
    personB.spousalBenefitWithRetirementPreARF = this.benefitService.calculateSpousalBenefit(personB, personA, personB.initialRetirementBenefit, personB.spousalBenefitDate)
    personA.survivorBenefitWithoutRetirement = this.benefitService.calculateSurvivorBenefit(personA, 0, personA.survivorFRA, personB, personB.retirementBenefitDate, personB.retirementBenefitDate)
    personA.survivorBenefitWithRetirementPreARF = this.benefitService.calculateSurvivorBenefit(personA, personA.initialRetirementBenefit, personA.survivorFRA, personB, personB.retirementBenefitDate, personB.retirementBenefitDate)
    personB.survivorBenefitWithoutRetirement = this.benefitService.calculateSurvivorBenefit(personB, 0, personB.survivorFRA, personA, personA.retirementBenefitDate, personA.retirementBenefitDate)
    personB.survivorBenefitWithRetirementPreARF = this.benefitService.calculateSurvivorBenefit(personB, personB.initialRetirementBenefit, personB.survivorFRA, personA, personA.retirementBenefitDate, personA.retirementBenefitDate)


    //Calculate PV via loop until both spouses are at least age 115 (by which point "remaining lives" is zero)
    while (personA.age < 115 || personB.age < 115){

      //count number of months in this year for which each type of benefit will be received
      calcYear = this.benefitService.CountCoupleBenefitMonths(scenario, calcYear, personA, personB)

      //Earnings test        
      if (earningsTestResult === undefined || calcYear.date.getFullYear() <= personA.FRA.getFullYear() || calcYear.date.getFullYear() <= personB.FRA.getFullYear()){//Only have to run earnings test if it's before FRA or if it has never been run (has to be run once for after-ARF values to be calc'd)
        earningsTestResult = this.earningsTestService.earningsTestCouple(calcYear, scenario, personA, personB)
        calcYear = earningsTestResult[0]
        personA = earningsTestResult[1]
        personB = earningsTestResult[2]
      }
      
      //Calculate retirementBenefit with DRCs from suspension as well as new spousal/survivor benefits accounting for larger retirement benefit. (Only have to do this all once. Can't do it until a) final adjustedRetirementBenefitDate is known from earnings test and b) number of DRCs is known..)
      if (personA.retirementBenefitWithDRCsfromSuspension == 0 && calcYear.date.getFullYear() >= personA.FRA.getFullYear() && calcYear.date.getFullYear() >= personA.endSuspensionDate.getFullYear()) {
        personA.retirementBenefitWithDRCsfromSuspension = this.benefitService.calculateRetirementBenefit(personA, personA.adjustedRetirementBenefitDate)
        personA.spousalBenefitWithSuspensionDRCRetirement = this.benefitService.calculateSpousalBenefit(personA, personB, personA.retirementBenefitWithDRCsfromSuspension, personA.spousalBenefitDate)
        personA.survivorBenefitWithSuspensionDRCRetirement = this.benefitService.calculateSurvivorBenefit(personA, personA.retirementBenefitWithDRCsfromSuspension, personA.survivorFRA, personB, personB.retirementBenefitDate, personB.retirementBenefitDate)
      }
      if (personB.retirementBenefitWithDRCsfromSuspension == 0 && calcYear.date.getFullYear() >= personB.FRA.getFullYear() && calcYear.date.getFullYear() >= personB.endSuspensionDate.getFullYear()) {
        personB.retirementBenefitWithDRCsfromSuspension = this.benefitService.calculateRetirementBenefit(personB, personB.adjustedRetirementBenefitDate)
        personB.spousalBenefitWithSuspensionDRCRetirement = this.benefitService.calculateSpousalBenefit(personB, personA, personB.retirementBenefitWithDRCsfromSuspension, personB.spousalBenefitDate)
        personB.survivorBenefitWithSuspensionDRCRetirement = this.benefitService.calculateSurvivorBenefit(personB, personB.retirementBenefitWithDRCsfromSuspension, personB.survivorFRA, personA, personA.retirementBenefitDate, personA.retirementBenefitDate)
      }

      //Calculate annual benefits, accounting for Adjustment Reduction Factor in years beginning at FRA
      calcYear = this.benefitService.calculateAnnualBenefitAmountsCouple(personA, personB, calcYear, debugTable)
      if (debugTable === true) {scenario.debugTable.push(calcYear.debugTableRow)}

      //If user is divorced, we don't actually want to include the ex-spouse's benefit amounts in our PV sum
      if (scenario.maritalStatus == "divorced") {
        calcYear.personBannualRetirementBenefit = 0
        calcYear.personBannualSpousalBenefit = 0
        calcYear.personBannualSurvivorBenefit = 0
      }


      //Calculate each person's probability of being alive at end of age in question
        probabilityAalive = this.mortalityService.calculateProbabilityAlive(personA, personA.age)
        probabilityBalive = this.mortalityService.calculateProbabilityAlive(personB, personB.age)

      //Find total probability-weighted annual benefit
        let annualPV = 
        (probabilityAalive * (1-probabilityBalive) * (calcYear.personAannualRetirementBenefit + calcYear.personAannualSurvivorBenefit)) //Scenario where A is alive, B is deceased
        + (probabilityBalive * (1-probabilityAalive) * (calcYear.personBannualRetirementBenefit + calcYear.personBannualSurvivorBenefit)) //Scenario where B is alive, A is deceased
        + ((probabilityAalive * probabilityBalive) * (calcYear.personAannualRetirementBenefit + calcYear.personAannualSpousalBenefit + calcYear.personBannualRetirementBenefit + calcYear.personBannualSpousalBenefit)) //Scenario where both are alive

      //Discount that benefit
            //Find which spouse is older, because we're discounting back to date on which older spouse is age 62.
            let olderAge: number
            if (personA.age > personB.age) {
              olderAge = personA.age
            } else {olderAge = personB.age}
            //Here is where actual discounting happens. Discounting by half a year, because we assume all benefits received mid-year. Then discounting for any additional years needed to get back to PV at 62.
            annualPV = annualPV / (1 + scenario.discountRate/100/2) / Math.pow((1 + scenario.discountRate/100),(olderAge - 62))


      //Add discounted benefit to ongoing count of retirementPV, add 1 to each age, add 1 year to currentCalculationDate, and start loop over
        couplePV = couplePV + annualPV
        personA.age = personA.age + 1
        personB.age = personB.age + 1
        //calcYear.date.setFullYear(calcYear.date.getFullYear()+1)
        let newCalcDate:Date = new Date(calcYear.date.getFullYear()+1, 0, 1)
        calcYear = new CalculationYear(newCalcDate)
    }

    return couplePV
  }




  maximizeSinglePersonPV(person:Person, scenario:ClaimingScenario){
    //find initial testClaimingDate for age 62
    person.retirementBenefitDate = new Date(person.SSbirthDate.getFullYear()+62, 1, 1)
    if (person.actualBirthDate.getDate() <= 2){
      person.retirementBenefitDate.setMonth(person.actualBirthDate.getMonth())
    } else {
      person.retirementBenefitDate.setMonth(person.actualBirthDate.getMonth()+1)
    }

    //If user is currently over age 62 when filling out form, set testClaimingDate to today's month/year instead of their age 62 month/year, so that calc starts today instead of 62.
    let ageToday = this.today.getFullYear() - person.SSbirthDate.getFullYear() + (this.today.getMonth() - person.SSbirthDate.getMonth())/12
    if (ageToday > 62){
      person.retirementBenefitDate.setMonth(this.today.getMonth())
      person.retirementBenefitDate.setFullYear(this.today.getFullYear())
    }

    //Run calculateSinglePersonPV for their earliest possible claiming date, save the PV and the date.
    let savedPV: number = this.calculateSinglePersonPV(person, scenario, false)
    let savedClaimingDate = new Date(person.retirementBenefitDate)

    //Set endingTestDate equal to the month before they turn 70 (because loop starts with adding a month and then testing new values)
    let endingTestDate = new Date(person.SSbirthDate.getFullYear()+70, person.SSbirthDate.getMonth()-1, 1)
    while (person.retirementBenefitDate <= endingTestDate){
      //Add 1 month to claiming age and run both calculations again and compare results. Save better of the two. (If they're literally the same, save the second one tested, because it gives better longevity insurance)
      person.retirementBenefitDate.setMonth(person.retirementBenefitDate.getMonth() + 1)
      let currentTestPV = this.calculateSinglePersonPV(person, scenario, false)
      if (currentTestPV >= savedPV)
        {savedClaimingDate.setMonth(person.retirementBenefitDate.getMonth())
          savedClaimingDate.setFullYear(person.retirementBenefitDate.getFullYear())
          savedPV = currentTestPV}
    }
    //after loop is finished
    console.log("saved PV: " + savedPV)
    console.log("savedClaimingDate: " + savedClaimingDate.toLocaleDateString())

    //Generate solution set (for sake of output) from saved values
    let solutionSet:SolutionSet = this.solutionSetService.generateSingleSolutionSet(scenario, person.SSbirthDate, person, Number(savedPV), savedClaimingDate)
    this.maximizedOrNot = true
    return solutionSet
  }


  maximizeCouplePViterateBothPeople(personA:Person, personB:Person, scenario:ClaimingScenario){

    //find initial retirementBenefitDate for personA (first month for which they are considered 62 for entire month)
    personA.retirementBenefitDate = new Date(personA.actualBirthDate.getFullYear()+62, personA.actualBirthDate.getMonth(), 1)
    if (personA.actualBirthDate.getDate() > 2){
      personA.retirementBenefitDate.setMonth(personA.retirementBenefitDate.getMonth()+1)
    }
    //If personA is currently over age 62 when filling out form, adjust their initial retirementBenefitDate to today's month/year instead of their age 62 month/year.
    let spouseAageToday: number = this.today.getFullYear() - personA.SSbirthDate.getFullYear() + (this.today.getMonth() - personA.SSbirthDate.getMonth()) /12
    if (spouseAageToday > 62){
      personA.retirementBenefitDate.setMonth(this.today.getMonth())
      personA.retirementBenefitDate.setFullYear(this.today.getFullYear())
    }
    //Do all of the same, but for personB.
    personB.retirementBenefitDate = new Date(personB.actualBirthDate.getFullYear()+62, personB.actualBirthDate.getMonth(), 1)
    if (personB.actualBirthDate.getDate() > 2){
      personB.retirementBenefitDate.setMonth(personB.retirementBenefitDate.getMonth()+1)
    }
    let spouseBageToday: number = this.today.getFullYear() - personB.SSbirthDate.getFullYear() + (this.today.getMonth() - personB.SSbirthDate.getMonth()) /12
    if (spouseBageToday > 62){
      personB.retirementBenefitDate.setMonth(this.today.getMonth())
      personB.retirementBenefitDate.setFullYear(this.today.getFullYear())
    }

    //If either person has already filed or is on disability, initialize that person's begin&end suspension date as their FRA (but no earlier than today), and set that person's retirementBenefitDate using fixedRetirementBenefitDate field 
    if (personA.isDisabled === true || scenario.personAhasFiled === true) {
      if (this.today > personA.FRA){
        personA.beginSuspensionDate = new Date(this.today)
        personA.endSuspensionDate = new Date(this.today)
      }
      else {
        personA.beginSuspensionDate = new Date(personA.FRA)
        personA.endSuspensionDate = new Date(personA.FRA)
      }
      personA.retirementBenefitDate = new Date(personA.fixedRetirementBenefitDate)
    }
    if (personB.isDisabled === true || scenario.personBhasFiled === true) {
      if (this.today > personB.FRA){
        personB.beginSuspensionDate = new Date(this.today)
        personB.endSuspensionDate = new Date(this.today)
      }
      else {
        personB.beginSuspensionDate = new Date(personB.FRA)
        personB.endSuspensionDate = new Date(personB.FRA)
      }
      personB.retirementBenefitDate = new Date(personB.fixedRetirementBenefitDate)
    }

    //Set initial spousalBenefitDates based on initial retirementBenefitDates
    personA = this.adjustSpousalBenefitDate(personA, personB, scenario)
    personB = this.adjustSpousalBenefitDate(personB, personA, scenario)

    //Initialize savedPV as zero. Save various initial test dates.
      let savedPV: number = 0
      let personAsavedRetirementDate = new Date(personA.retirementBenefitDate)
      let personBsavedRetirementDate = new Date(personB.retirementBenefitDate)
      let personAsavedSpousalDate = new Date(personA.spousalBenefitDate)
      let personBsavedSpousalDate = new Date(personB.spousalBenefitDate)
      let personAsavedBeginSuspensionDate = new Date(personA.beginSuspensionDate)
      let personBsavedBeginSuspensionDate = new Date(personB.beginSuspensionDate)
      let personAsavedEndSuspensionDate = new Date(personA.endSuspensionDate)
      let personBsavedEndSuspensionDate = new Date(personB.endSuspensionDate)

    //Set endingTestDate for each spouse equal to the month they turn 70
    let spouseAendTestDate = new Date(personA.SSbirthDate.getFullYear()+70, personA.SSbirthDate.getMonth(), 1)
    let spouseBendTestDate = new Date(personB.SSbirthDate.getFullYear()+70, personB.SSbirthDate.getMonth(), 1)

    while (personA.retirementBenefitDate <= spouseAendTestDate && personA.endSuspensionDate <= spouseAendTestDate) {
        //Reset personB.retirementBenefitDate to earliest possible (i.e., their "age 62 for whole month" month or today's month if they're currently older than 62)
        if (spouseBageToday > 62){
          personB.retirementBenefitDate.setMonth(this.today.getMonth())
          personB.retirementBenefitDate.setFullYear(this.today.getFullYear())
        } else {
          personB.retirementBenefitDate = new Date(personB.actualBirthDate.getFullYear()+62, personB.actualBirthDate.getMonth(), 1)
          if (personB.actualBirthDate.getDate() > 2){
            personB.retirementBenefitDate.setMonth(personB.retirementBenefitDate.getMonth()+1)
          }
        }
        //If personB is disabled or already filed, reset suspension begin/end dates, and set retirementBenefitDate using fixedRetirementBenefitDate field
          if (personB.isDisabled === true || scenario.personBhasFiled === true) {
            if (this.today > personB.FRA){
              personB.beginSuspensionDate = new Date(this.today)
              personB.endSuspensionDate = new Date(this.today)
            }
            else {
              personB.beginSuspensionDate = new Date(personB.FRA)
              personB.endSuspensionDate = new Date(personB.FRA)
            }
            personB.retirementBenefitDate = new Date(personB.fixedRetirementBenefitDate)
          }

        //After personB's retirement testdate has been reset, reset spousal dates as necessary for personA and personB
          personA = this.adjustSpousalBenefitDate(personA, personB, scenario)
          personB = this.adjustSpousalBenefitDate(personB, personA, scenario)

        while (personB.retirementBenefitDate <= spouseBendTestDate && personB.endSuspensionDate <= spouseBendTestDate) {
          //Calculate PV using current testDates
            let currentTestPV: number = this.calculateCouplePV(personA, personB, scenario, false)
            //If PV is greater than saved PV, save new PV and save new testDates.
            if (currentTestPV >= savedPV) {
              savedPV = currentTestPV
              personAsavedRetirementDate = new Date(personA.retirementBenefitDate)
              personBsavedRetirementDate = new Date(personB.retirementBenefitDate)
              personAsavedSpousalDate = new Date(personA.spousalBenefitDate)
              personBsavedSpousalDate = new Date(personB.spousalBenefitDate)
              personAsavedBeginSuspensionDate = new Date(personA.beginSuspensionDate)
              personBsavedBeginSuspensionDate = new Date(personB.beginSuspensionDate)
              personAsavedEndSuspensionDate = new Date(personA.endSuspensionDate)
              personBsavedEndSuspensionDate = new Date(personB.endSuspensionDate)
              }

          //Find next possible claiming combination for spouseB
            personB = this.incrementRetirementORendSuspensionDate(personB, scenario)
            personB = this.adjustSpousalBenefitDate(personB, personA, scenario)

          //After personB's retirement/spousal dates have been incremented, adjust personA's spousal date as necessary
            personA = this.adjustSpousalBenefitDate(personA, personB, scenario)

        }
        //Increment personA's retirementBenefitDate
          personA = this.incrementRetirementORendSuspensionDate(personA, scenario)
        
      }
    //after loop is finished
      console.log("saved PV: " + savedPV)
      console.log("personAsavedRetirementDate: " + personAsavedRetirementDate.toLocaleDateString())
      console.log("personBsavedRetirementDate: " + personBsavedRetirementDate.toLocaleDateString())
      console.log("personAsavedSpousalDate: " + personAsavedSpousalDate.toLocaleDateString())
      console.log("personBsavedSpousalDate: " + personBsavedSpousalDate.toLocaleDateString())
      console.log("personAsavedendSuspensionDate: " + personAsavedEndSuspensionDate.toLocaleDateString())
      console.log("personBsavedendSuspensionDate: " + personBsavedEndSuspensionDate.toLocaleDateString())

      //Generate solution set (for sake of output) from saved values
      let solutionSet:SolutionSet = this.solutionSetService.generateCoupleSolutionSet(scenario, personA, personB, personAsavedRetirementDate, personBsavedRetirementDate,
        personAsavedSpousalDate, personBsavedSpousalDate, personAsavedBeginSuspensionDate, personAsavedEndSuspensionDate, personBsavedBeginSuspensionDate, personBsavedEndSuspensionDate, Number(savedPV))
      
      this.maximizedOrNot = true
      return solutionSet
  }


//This function is for when one spouse is over 70 (and therefore has no retirement age or suspension age to iterate).
//Also is the function for a divorcee, because we take the ex-spouse's filing date as a given (i.e., as an input)
maximizeCouplePViterateOnePerson(scenario:ClaimingScenario, flexibleSpouse:Person, fixedSpouse:Person){

    fixedSpouse.retirementBenefitDate = fixedSpouse.fixedRetirementBenefitDate

    //find initial retirementBenefitDate for flexibleSpouse (first month for which flexibleSpouse is considered 62 for entire month)
    flexibleSpouse.retirementBenefitDate = new Date(flexibleSpouse.actualBirthDate.getFullYear()+62, flexibleSpouse.actualBirthDate.getMonth(), 1)
    if (flexibleSpouse.actualBirthDate.getDate() > 2){
      flexibleSpouse.retirementBenefitDate.setMonth(flexibleSpouse.retirementBenefitDate.getMonth()+1)
    }
    //If flexibleSpouse is currently over age 62 when filling out form, adjust their initial retirementBenefitDate to today's month/year instead of their age 62 month/year.
    let flexibleSpouseAgeToday: number = this.today.getFullYear() - flexibleSpouse.SSbirthDate.getFullYear() + (this.today.getMonth() - flexibleSpouse.SSbirthDate.getMonth()) /12
    if (flexibleSpouseAgeToday > 62){
      flexibleSpouse.retirementBenefitDate.setMonth(this.today.getMonth())
      flexibleSpouse.retirementBenefitDate.setFullYear(this.today.getFullYear())
    }

    //Set initial spousalBenefitDate for flexibleSpouse
      flexibleSpouse = this.adjustSpousalBenefitDate(flexibleSpouse, fixedSpouse, scenario)

    //Initialize savedPV as zero. Set saved dates equal to their current testDates.
    let savedPV: number = 0
    let flexibleSpouseSavedRetirementDate = new Date(flexibleSpouse.retirementBenefitDate)
    let flexibleSpouseSavedSpousalDate = new Date(flexibleSpouse.spousalBenefitDate)

    //Set endTestDate equal to the month flexibleSpouse turns 70
    let endTestDate = new Date(flexibleSpouse.SSbirthDate.getFullYear()+70, flexibleSpouse.SSbirthDate.getMonth(), 1)

    //In theory: set fixed spouse's spousalDate equal to later of their own retirement benefit date or flexible spouse's retirement benefit date
        //In actuality: set it equal to flexible spouse's retirement benefit date, because that's always the later of the two (since fixed has already filed) 
        //For divorcee this date won't matter at all, since annual PV is ultimately set to zero for spouse b's spousal benefit, but PV calc will require it.
    fixedSpouse.spousalBenefitDate = new Date(flexibleSpouse.retirementBenefitDate)
    let fixedSpouseSavedSpousalDate: Date = new Date(fixedSpouse.spousalBenefitDate)            

    while (flexibleSpouse.retirementBenefitDate <= endTestDate) {
      //Calculate PV using current test dates for flexibleSpouse and fixed dates for fixedSpouse
      if (flexibleSpouse.id == "A"){
        var currentTestPV: number = this.calculateCouplePV(flexibleSpouse, fixedSpouse, scenario, false)
      }
      else {
        var currentTestPV: number = this.calculateCouplePV(fixedSpouse, flexibleSpouse, scenario, false)
      }

      //If PV is greater than or equal to saved PV, save new PV and save new testDates
      if (currentTestPV >= savedPV) {
        savedPV = currentTestPV
        flexibleSpouseSavedRetirementDate.setMonth(flexibleSpouse.retirementBenefitDate.getMonth())
        flexibleSpouseSavedRetirementDate.setFullYear(flexibleSpouse.retirementBenefitDate.getFullYear())
        flexibleSpouseSavedSpousalDate.setMonth(flexibleSpouse.spousalBenefitDate.getMonth())
        flexibleSpouseSavedSpousalDate.setFullYear(flexibleSpouse.spousalBenefitDate.getFullYear())
        fixedSpouseSavedSpousalDate.setMonth(fixedSpouse.spousalBenefitDate.getMonth())
        fixedSpouseSavedSpousalDate.setFullYear(fixedSpouse.spousalBenefitDate.getFullYear())
        }
      
      //Increment flexibleSpouse's dates (and fixedSpouse's spousal date, since it is just set to be same as flexible spouse's retirement date)
        flexibleSpouse.retirementBenefitDate.setMonth(flexibleSpouse.retirementBenefitDate.getMonth()+1)
        fixedSpouse.spousalBenefitDate.setMonth(fixedSpouse.spousalBenefitDate.getMonth()+1)
        flexibleSpouse = this.adjustSpousalBenefitDate(flexibleSpouse, fixedSpouse, scenario)

    }
      //after loop is finished
      console.log("saved PV: " + savedPV)
      console.log("saved flexibleSpouseRetirementDate: " + flexibleSpouseSavedRetirementDate.toLocaleDateString())
      console.log("saved flexibleSpouseSpousalDate: " + flexibleSpouseSavedSpousalDate.toLocaleDateString())
  
      let solutionSet:SolutionSet = this.solutionSetService.generateCoupleOneHasFiledSolutionSet(flexibleSpouse, fixedSpouse, scenario,
      flexibleSpouseSavedRetirementDate, flexibleSpouseSavedSpousalDate, fixedSpouse.fixedRetirementBenefitDate, fixedSpouseSavedSpousalDate, Number(savedPV))


      this.maximizedOrNot = true
      return solutionSet
  }

  //Adjusts spousal date as necessary. Is used after new retirement date is selected for either person.
  adjustSpousalBenefitDate(person:Person, otherPerson:Person, scenario:ClaimingScenario){
    let deemedFilingCutoff: Date = new Date(1954, 0, 1)
    let otherPersonsLimitingDate: Date

    //Determine "otherPerson's Limiting Date" (i.e., the date -- based on otherPerson -- before which "Person" cannot file a spousal benefit)
    if (scenario.maritalStatus == "married") {
      otherPersonsLimitingDate = otherPerson.retirementBenefitDate
    }
    if (scenario.maritalStatus == "divorced"){//If divorced, otherPersonsLimitingDate is first month for which otherPerson is age 62 all month
      otherPersonsLimitingDate = new Date(otherPerson.actualBirthDate.getFullYear()+62, otherPerson.actualBirthDate.getMonth(), 1)
      if (otherPerson.actualBirthDate.getDate() > 2) {
        otherPersonsLimitingDate.setMonth(otherPersonsLimitingDate.getMonth()+1)
      }
    }
    if (otherPerson.isDisabled === true){//If otherPerson is disabled, there is no "otherPersonsLimitingDate." So just make this own "age 62 all month" month
    //Also, this check has to come last since it overrides others.
      otherPersonsLimitingDate = new Date(person.actualBirthDate.getFullYear()+62, person.actualBirthDate.getMonth(), 1)
      if (person.actualBirthDate.getDate() > 2){
        otherPersonsLimitingDate.setMonth(otherPersonsLimitingDate.getMonth()+1)
      }
    }

    if (person.actualBirthDate > deemedFilingCutoff) {//i.e., if person has new deemed filing rules
      //set spousalBenefitDate to own retirementBenefitDate, but no earlier than otherPersonsLimitingDate
      if (person.retirementBenefitDate > otherPersonsLimitingDate) {
        person.spousalBenefitDate = new Date(person.retirementBenefitDate)
      } else {
        person.spousalBenefitDate = new Date(otherPersonsLimitingDate)
      }
    }
    else {//i.e., if person has old deemed filing rules
      if (person.retirementBenefitDate < person.FRA) {
        //set spousalBenefitDate to own retirementBenefitDate, but no earlier than otherPersonsLimitingDate
        if (person.retirementBenefitDate > otherPersonsLimitingDate) {
          person.spousalBenefitDate = new Date(person.retirementBenefitDate)
        } else {
          person.spousalBenefitDate = new Date(otherPersonsLimitingDate)
        }
      }
      else {//i.e., if person's retirementBenefitDate currently after his/her FRA
        //Set person's spousalBenefitlDate to earliest possible restricted application date (i.e., later of FRA or otherPersonsLimitingDate)
        if (person.FRA > otherPersonsLimitingDate) {
          person.spousalBenefitDate = new Date(person.FRA)
        } else {
          person.spousalBenefitDate = new Date(otherPersonsLimitingDate)
        }
      }
    }

    //Don't let spousalBenefitDate be earlier than today
    if (person.spousalBenefitDate < this.today){
      person.spousalBenefitDate = new Date(this.today)
    }
    
    return person
  }

  incrementRetirementORendSuspensionDate(person:Person, scenario:ClaimingScenario){
    if (person.isDisabled) {
      person.endSuspensionDate.setMonth(person.endSuspensionDate.getMonth()+1)
    }
    else if ( (scenario.personAhasFiled && person.id == "A") || (scenario.personBhasFiled && person.id == "B") ){
      person.endSuspensionDate.setMonth(person.endSuspensionDate.getMonth()+1)
    }
    else {//i.e., person hasn't filed and isn't disabled
    person.retirementBenefitDate.setMonth(person.retirementBenefitDate.getMonth()+1)
  }
    return person
  }
}
