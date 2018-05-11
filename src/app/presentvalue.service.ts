import { Injectable } from '@angular/core';
import {BirthdayService} from './birthday.service'
import {BenefitService} from './benefit.service'
import { CurrencyPipe } from '@angular/common';

@Injectable()
export class PresentvalueService {

  constructor(private benefitService: BenefitService, private birthdayService: BirthdayService) { }
  
  calculateSinglePersonPV(FRA: Date, SSbirthDate: Date, PIA: number, inputBenefitDate: Date, gender: string, discountRate: number)
  {
    let retirementBenefit: number = this.benefitService.calculateRetirementBenefit(PIA, FRA, inputBenefitDate)
    let retirementPV: number = 0
    let roundedAge: number = 0
    let probabilityAlive: number = 0

    //calculate age when they start benefit
    let age: number = ( inputBenefitDate.getMonth() - (SSbirthDate.getMonth()) + 12 * (inputBenefitDate.getFullYear() - SSbirthDate.getFullYear()) )/12

    //calculate age when filling out form
    let today: Date = new Date()
    let initialAge: number = today.getFullYear() - SSbirthDate.getFullYear() + (today.getMonth() - SSbirthDate.getMonth())/12
    let initialAgeRounded: number = Math.round(initialAge)
    let discountTargetAge: number
    
    //Calculate PV via loop until they hit age 118 (by which point "remaining lives" is zero)
      while (age < 115) {
        //When calculating probability alive, we have to round age to get a whole number to use for lookup in array.
        //Normally we round age down and use that number for the whole year. But sometimes, for example, real age will be 66 but javascript sees it as 65.99999, so we have to round that up.
        if (age%1 > 0.999) {
          roundedAge = Math.round(age)
          }
          else {roundedAge = Math.floor(age)}
        //Calculate probability of being alive at age in question.
        if (initialAgeRounded <= 62) {
            if (gender == "male") {probabilityAlive = this.maleLivesRemaining[roundedAge + 1] / this.maleLivesRemaining[62]}
            if (gender == "female") {probabilityAlive = this.femaleLivesRemaining[roundedAge + 1] / this.femaleLivesRemaining[62]}
        }
          //If they're older than 62 when filling out form, denominator is lives remaining at age when filling out the form.
          else { 
            if (gender == "male") {probabilityAlive = this.maleLivesRemaining[roundedAge + 1] / this.maleLivesRemaining[initialAgeRounded]}
            if (gender == "female") {probabilityAlive = this.femaleLivesRemaining[roundedAge + 1] / this.femaleLivesRemaining[initialAgeRounded]}
          }
        
        //Calculate probability-weighted benefit
        let monthlyPV = retirementBenefit * probabilityAlive
        //Discount that benefit to age 62
        monthlyPV = monthlyPV / (1 + discountRate/2) //e.g., benefits received during age 62 must be discounted for 0.5 years
        monthlyPV = monthlyPV / Math.pow((1 + discountRate),(roundedAge - 62)) //e.g., benefits received during age 63 must be discounted for 1.5 years
        //Add discounted benefit to ongoing count of retirementPV, add 1 month to age, and start loop over
        retirementPV = retirementPV + monthlyPV
        age = age + 1/12
      }
        return retirementPV
  }

  calculateCouplePV(spouseASSbirthDate: Date, spouseBSSbirthDate: Date, spouseAFRA: Date, spouseBFRA: Date, spouseAsurvivorFRA:Date, spouseBsurvivorFRA:Date,
    spouseAPIA: number, spouseBPIA: number, spouseAinputBenefitDate: Date, spouseBinputBenefitDate: Date, spouseAgender: string, spouseBgender:string, discountRate:number){
    let spouseAretirementBenefit: number = 0
    let spouseBretirementBenefit: number = 0
    let spouseAspousalBenefit: number
    let spouseBspousalBenefit: number
    let spouseAsurvivorBenefit: number = 0
    let spouseBsurvivorBenefit: number = 0
    let spouseAage: number
    let spouseAroundedAge: number
    let probabilityAalive: number
    let spouseBage: number
    let spouseBroundedAge: number
    let probabilityBalive: number
    let couplePV = 0
    let firstStartDate: Date
    let secondStartDate: Date

    //If spouse A's input benefit date earlier, set firstStartDate and secondStartDate accordingly.
    if (spouseAinputBenefitDate < spouseBinputBenefitDate)
      {
      firstStartDate = new Date(spouseAinputBenefitDate)
      secondStartDate = new Date(spouseBinputBenefitDate)
      }
    else {//This is fine as a simple "else" statement. If the two input benefit dates are equal, doing it as of either date is fine.
    firstStartDate = new Date(spouseBinputBenefitDate)
    secondStartDate = new Date(spouseAinputBenefitDate)
      }
    
    //Find age of each spouse as of firstStartDate
    spouseAage = ( firstStartDate.getMonth() - spouseASSbirthDate.getMonth() + 12 * (firstStartDate.getFullYear() - spouseASSbirthDate.getFullYear()) )/12
    spouseBage = ( firstStartDate.getMonth() - spouseBSSbirthDate.getMonth() + 12 * (firstStartDate.getFullYear() - spouseBSSbirthDate.getFullYear()) )/12

    //calculate ages when filling out form TODO: This doesn't have to happen here. It could happen in onSubmit so that it only happens once rather than 96*96 times.
    let today: Date = new Date()
    let spouseAinitialAgeRounded = Math.round(today.getFullYear() - spouseASSbirthDate.getFullYear() + (today.getMonth() - spouseASSbirthDate.getMonth())/12)
    let spouseBinitialAgeRounded = Math.round(today.getFullYear() - spouseBSSbirthDate.getFullYear() + (today.getMonth() - spouseBSSbirthDate.getMonth())/12)



    //Calculate PV via loop until both spouses are at least age 115 (by which point "remaining lives" alive is zero)
    let currentTestDate: Date = new Date(firstStartDate)
    while (spouseAage < 115 || spouseBage < 115){
      //Both spouses must have filed before there can be spousal benefits. If both have reached start date, both spousal benefits are calculated as of secondStartDate
      if (currentTestDate < secondStartDate){
        spouseAspousalBenefit = 0
        spouseBspousalBenefit = 0
        }
        else {
        spouseAspousalBenefit = this.benefitService.calculateSpousalBenefit(spouseAPIA, spouseBPIA, spouseAFRA, spouseAinputBenefitDate, secondStartDate)
        spouseBspousalBenefit = this.benefitService.calculateSpousalBenefit(spouseBPIA, spouseAPIA, spouseBFRA, spouseBinputBenefitDate, secondStartDate)
        }

      //Retirement benefit A is zero if currentTestDate is prior to spouseAinputBenefitDate. Otherwise retirement benefit A is calculated as of spouseAinputBenefitDate.
      if (currentTestDate < spouseAinputBenefitDate) {
        spouseAretirementBenefit = 0
        }
        else {spouseAretirementBenefit = this.benefitService.calculateRetirementBenefit(spouseAPIA, spouseAFRA, spouseAinputBenefitDate)
        }
      //Retirement benefit B is zero if currentTestDate is prior to spouseBinputBenefitDate. Otherwise retirement benefit B is calculated as of spouseBinputBenefitDate.
      if (currentTestDate < spouseBinputBenefitDate) {
        spouseBretirementBenefit = 0
        }
        else {spouseBretirementBenefit = this.benefitService.calculateRetirementBenefit(spouseBPIA, spouseBFRA, spouseBinputBenefitDate)
        }
      //Survivor benefits are zero before survivorFRA, after survivorFRA, calculate each spouse's survivor benefit using other spouse's intended claiming age as their date of death. (That is, assuming that other spouse lives to their intended claiming age.)
        if (currentTestDate < spouseAsurvivorFRA) {
          spouseAsurvivorBenefit = 0    //<-- This will get changed when we incorporate restricted applications for survivor benefits
        } else {
          spouseAsurvivorBenefit = this.benefitService.calculateSurvivorBenefit(spouseASSbirthDate, spouseAsurvivorFRA, spouseAretirementBenefit, spouseAsurvivorFRA, spouseBFRA, spouseBinputBenefitDate, spouseBPIA, spouseBinputBenefitDate)
        }
        if (currentTestDate < spouseBsurvivorFRA){
          spouseBsurvivorBenefit = 0    //<-- This will get changed when we incorporate restricted applications for survivor benefits
        } else {
          spouseBsurvivorBenefit = this.benefitService.calculateSurvivorBenefit(spouseBSSbirthDate, spouseBsurvivorFRA, spouseBretirementBenefit, spouseBsurvivorFRA, spouseAFRA, spouseAinputBenefitDate, spouseAPIA, spouseAinputBenefitDate)

        }

      //Calculate probability of spouseA being alive at given age
        //When calculating probability alive, we have to round age to get a whole number to use for lookup in array.
        //Normally we round age down and use that number for the whole year. But sometimes, for example, real age will be 66 but javascript sees it as 65.99999, so we have to round that up.
          if (spouseAage%1 > 0.99) {
          spouseAroundedAge = Math.round(spouseAage)
          }
          else {spouseAroundedAge = Math.floor(spouseAage)}
          //Calculate probability of being alive at age in question.
          if (spouseAinitialAgeRounded <= 62) {
            if (spouseAgender == "male") {probabilityAalive = this.maleLivesRemaining[spouseAroundedAge + 1] / this.maleLivesRemaining[62]}
            if (spouseAgender == "female") {probabilityAalive = this.femaleLivesRemaining[spouseAroundedAge + 1] / this.femaleLivesRemaining[62]}
          }
          //If spouseA is older than 62 when filling out form, denominator is lives remaining at age when filling out the form.
          else { 
            if (spouseAgender == "male") {probabilityAalive = this.maleLivesRemaining[spouseAroundedAge + 1] / this.maleLivesRemaining[spouseAinitialAgeRounded]}
            if (spouseAgender == "female") {probabilityAalive = this.femaleLivesRemaining[spouseAroundedAge + 1] / this.femaleLivesRemaining[spouseAinitialAgeRounded]}
          }
      //Do same math to calculate probability of spouseB being alive at given age
          //calculate rounded age
          if (spouseBage%1 > 0.99) {
          spouseBroundedAge = Math.round(spouseBage)
          }
          else {spouseBroundedAge = Math.floor(spouseBage)}
          //use rounded age and lives remaiing array to calculate probability
          if (spouseBinitialAgeRounded <= 62) {
            if (spouseBgender == "male") {probabilityBalive = this.maleLivesRemaining[spouseBroundedAge + 1] / this.maleLivesRemaining[62]}
            if (spouseBgender == "female") {probabilityBalive = this.femaleLivesRemaining[spouseBroundedAge + 1] / this.femaleLivesRemaining[62]}
          }
          //If spouseA is older than 62 when filling out form, denominator is lives remaining at age when filling out the form.
          else { 
            if (spouseBgender == "male") {probabilityBalive = this.maleLivesRemaining[spouseBroundedAge + 1] / this.maleLivesRemaining[spouseBinitialAgeRounded]}
            if (spouseBgender == "female") {probabilityBalive = this.femaleLivesRemaining[spouseBroundedAge + 1] / this.femaleLivesRemaining[spouseBinitialAgeRounded]}
          }
      //Find probability-weighted benefit
        let monthlyPV = 
        (probabilityAalive * (1-probabilityBalive) * (spouseAretirementBenefit + spouseAsurvivorBenefit)) //Scenario where A is alive, B is deceased
        + (probabilityBalive * (1-probabilityAalive) * (spouseBretirementBenefit + spouseBsurvivorBenefit)) //Scenario where B is alive, A is deceased
        + ((probabilityAalive * probabilityBalive) * (spouseAretirementBenefit + spouseAspousalBenefit + spouseBretirementBenefit + spouseBspousalBenefit)) //Scenario where both are alive
      
      //Discount that benefit
            //Find which spouse is older, because we're discounting back to date on which older spouse is age 62.
            let olderRoundedAge: number
            if (spouseAage > spouseBage) {
              olderRoundedAge = spouseAroundedAge
            } else {olderRoundedAge = spouseBroundedAge}
            //Here is where actual discounting happens. Discounting by half a year, because we assume all benefits received mid-year. Then discounting for any additional years needed to get back to PV at 62.
            monthlyPV = monthlyPV / (1 + discountRate/2) / Math.pow((1 + discountRate),(olderRoundedAge - 62))
      //Add discounted benefit to ongoing count of retirementPV, add 1 month to each age, add 1 month to currentTestDate, and start loop over
        couplePV = couplePV + monthlyPV
        spouseAage = spouseAage + 1/12
        spouseBage = spouseBage + 1/12
        currentTestDate.setMonth(currentTestDate.getMonth()+1)
    }

    return couplePV
  }


  maximizeSinglePersonPV(PIA: number, SSbirthDate: Date, FRA: Date, gender: string, discountRate: number){
    //find initial currentTestDate for age 62
    let currentTestDate = new Date(SSbirthDate.getFullYear()+62, SSbirthDate.getMonth(), 1)

    //If they are currently over age 62 when filling out form, set currentTestDate to today's month/year instead of their age 62 month/year, so that calc starts today instead of 62.
    let today = new Date()
    let ageToday = today.getFullYear() - SSbirthDate.getFullYear() + (today.getMonth() - SSbirthDate.getMonth())/12
    if (ageToday > 62){
      currentTestDate.setMonth(today.getMonth())
      currentTestDate.setFullYear(today.getFullYear())
    }

    //Run calculateSinglePersonPV for their earliest possible claiming date, save the PV and the date.
    let savedPV: number = this.calculateSinglePersonPV(FRA, SSbirthDate, PIA, currentTestDate, gender, discountRate)
    let savedClaimingDate = new Date(currentTestDate)

    //Set endingTestDate equal to the month before they turn 70 (because loop starts with adding a month and then testing new values)
    let endingTestDate = new Date(SSbirthDate.getFullYear()+70, SSbirthDate.getMonth()-1, 1)
    while (currentTestDate <= endingTestDate){
      //Add 1 month to claiming age and run both calculations again and compare results. Save better of the two.
      currentTestDate.setMonth(currentTestDate.getMonth() + 1)
      let currentTestPV = this.calculateSinglePersonPV(FRA, SSbirthDate, PIA, currentTestDate, gender, discountRate)
      if (currentTestPV > savedPV)
        {savedClaimingDate.setMonth(currentTestDate.getMonth())
          savedClaimingDate.setFullYear(currentTestDate.getFullYear())
          savedPV = currentTestPV}
    }
    //after loop is finished
    console.log("saved PV: " + savedPV)
    console.log("savedClaimingDate: " + savedClaimingDate)
  }

  maximizeCouplePV(spouseAPIA: number, spouseBPIA: number, spouseASSbirthDate: Date, spouseBSSbirthDate: Date, spouseAFRA: Date, spouseBFRA: Date, spouseAsurvivorFRA:Date, spouseBsurvivorFRA:Date,
    spouseAgender: string, spouseBgender:string, discountRate: number){
    //find initial spouseAtestDate, for when spouseA is 62
    let spouseAtestDate = new Date(spouseASSbirthDate.getFullYear()+62, spouseASSbirthDate.getMonth(), 1)
    //If spouseA is currently over age 62 when filling out form, adjust their initial testDate to today's month/year instead of their age 62 month/year.
    let today = new Date()
    let spouseAageToday: number = today.getFullYear() - spouseASSbirthDate.getFullYear() + (today.getMonth() - spouseASSbirthDate.getMonth()) /12
    if (spouseAageToday > 62){
      spouseAtestDate.setMonth(today.getMonth())
      spouseAtestDate.setFullYear(today.getFullYear())
    }
    //Do all of the same, but for spouseB.
    let spouseBtestDate = new Date(spouseBSSbirthDate.getFullYear()+62, spouseBSSbirthDate.getMonth(), 1)
    let spouseBageToday: number = today.getFullYear() - spouseBSSbirthDate.getFullYear() + (today.getMonth() - spouseBSSbirthDate.getMonth()) /12
    if (spouseBageToday > 62){
      spouseBtestDate.setMonth(today.getMonth())
      spouseBtestDate.setFullYear(today.getFullYear())
    }
    //Initialize savedPV as zero. Set spouseAsavedDate and spouseBsavedDate equal to their current testDates.
      let savedPV: number = 0
      let spouseAsavedDate = new Date(spouseAtestDate)
      let spouseBsavedDate = new Date(spouseBtestDate)

    //Set endingTestDate for each spouse equal to the month they turn 70
    let spouseAendTestDate = new Date(spouseASSbirthDate.getFullYear()+70, spouseASSbirthDate.getMonth(), 1)
    let spouseBendTestDate = new Date(spouseBSSbirthDate.getFullYear()+70, spouseBSSbirthDate.getMonth(), 1)
    while (spouseAtestDate <= spouseAendTestDate) {
        //Reset spouseBtestDate to earliest possible (i.e., their Age62 month or today's month if they're currently older than 62)
        if (spouseBageToday > 62){
          spouseBtestDate.setMonth(today.getMonth())
          spouseBtestDate.setFullYear(today.getFullYear())
        } else {
          spouseBtestDate.setMonth(spouseBSSbirthDate.getMonth())
          spouseBtestDate.setFullYear(spouseBSSbirthDate.getFullYear()+62)
        }
        while (spouseBtestDate <= spouseBendTestDate) {
          //Calculate PV using current testDates
            let currentTestPV: number = this.calculateCouplePV(spouseASSbirthDate, spouseBSSbirthDate, spouseAFRA, spouseBFRA, spouseAsurvivorFRA, spouseBsurvivorFRA, Number(spouseAPIA), Number(spouseBPIA), spouseAtestDate, spouseBtestDate, spouseAgender, spouseBgender, Number(discountRate))
            //If PV is greater than saved PV, save new PV and save new testDates
            if (currentTestPV > savedPV) {
              savedPV = currentTestPV
              spouseAsavedDate.setMonth(spouseAtestDate.getMonth())
              spouseAsavedDate.setFullYear(spouseAtestDate.getFullYear())
              spouseBsavedDate.setMonth(spouseBtestDate.getMonth())
              spouseBsavedDate.setFullYear(spouseBtestDate.getFullYear())
              }
          //Add 1 month to spouseBtestDate
          spouseBtestDate.setMonth(spouseBtestDate.getMonth()+1)
        }
        //Add 1 month to spouseAtestDate
        spouseAtestDate.setMonth(spouseAtestDate.getMonth()+1)
      }
    //after loop is finished
      console.log("saved PV: " + savedPV)
      console.log("spouseAsavedDate: " + spouseAsavedDate)
      console.log("spouseBsavedDate: " + spouseBsavedDate)
  }


//Lives remaining out of 100k, from SSA 2014 period life table
maleLivesRemaining = [
  100000,
  99368,
  99328,
  99300,
  99279,
  99261,
  99245,
  99231,
  99218,
  99206,
  99197,
  99187,
  99177,
  99164,
  99144,
  99114,
  99074,
  99024,
  98963,
  98889,
  98802,
  98701,
  98588,
  98464,
  98335,
  98204,
  98072,
  97937,
  97801,
  97662,
  97520,
  97373,
  97224,
  97071,
  96914,
  96753,
  96587,
  96415,
  96236,
  96050,
  95856,
  95653,
  95437,
  95207,
  94958,
  94688,
  94394,
  94073,
  93721,
  93336,
  92913,
  92449,
  91943,
  91392,
  90792,
  90142,
  89439,
  88681,
  87867,
  87001,
  86081,
  85104,
  84065,
  82967,
  81812,
  80600,
  79324,
  77977,
  76550,
  75036,
  73427,
  71710,
  69878,
  67930,
  65866,
  63686,
  61377,
  58930,
  56344,
  53625,
  50776,
  47795,
  44685,
  41461,
  38148,
  34771,
  31358,
  27943,
  24565,
  21270,
  18107,
  15128,
  12381,
  9906,
  7733,
  5878,
  4348,
  3130,
  2194,
  1500,
  1001,
  652,
  413,
  254,
  151,
  87,
  48,
  26,
  13,
  6,
  3,
  1,
  1,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
]

femaleLivesRemaining = [
  100000,
  99469,
  99434,
  99412,
  99396,
  99383,
  99372,
  99361,
  99351,
  99342,
  99334,
  99325,
  99317,
  99307,
  99294,
  99279,
  99260,
  99237,
  99210,
  99180,
  99146,
  99109,
  99069,
  99025,
  98978,
  98929,
  98877,
  98822,
  98765,
  98705,
  98641,
  98575,
  98505,
  98431,
  98351,
  98266,
  98175,
  98076,
  97970,
  97856,
  97735,
  97604,
  97463,
  97311,
  97146,
  96966,
  96771,
  96559,
  96327,
  96072,
  95794,
  95488,
  95155,
  94794,
  94405,
  93987,
  93539,
  93057,
  92542,
  91997,
  91420,
  90809,
  90157,
  89461,
  88715,
  87914,
  87049,
  86114,
  85102,
  84006,
  82818,
  81525,
  80117,
  78591,
  76947,
  75182,
  73280,
  71225,
  69008,
  66621,
  64059,
  61304,
  58350,
  55213,
  51913,
  48467,
  44889,
  41191,
  37394,
  33531,
  29650,
  25811,
  22083,
  18536,
  15240,
  12250,
  9620,
  7378,
  5525,
  4043,
  2893,
  2021,
  1375,
  909,
  583,
  361,
  215,
  123,
  67,
  35,
  17,
  8,
  3,
  1,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
]

}