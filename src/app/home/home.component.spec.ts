import {TestBed, ComponentFixture} from '@angular/core/testing'
import {HomeComponent} from './home.component'
import {BirthdayService} from '../birthday.service'
import {PresentValueService} from '../presentvalue.service'
import {MortalityService} from '../mortality.service'
import {BenefitService} from '../benefit.service'
import {FREDresponse} from '../data model classes/fredresponse'
import {HttpClient} from '@angular/common/http'
import {Person} from '../data model classes/person'
import {CalculationScenario} from '../data model classes/calculationscenario'
import {MonthYearDate} from '../data model classes/monthyearDate'
import { NgForm, NgModel } from '@angular/forms'
import { AppRoutingModule } from '../app-routing.module'
import {AboutComponent} from '../about/about.component'
import { ContactComponent } from '../contact/contact.component'
import { LegalComponent } from '../legal/legal.component'
import { ChildinputsComponent } from '../childinputs/childinputs.component'
import { OutputTableComponent } from '../output-table/output-table.component'
import { APP_BASE_HREF } from '@angular/common'



describe('HomeComponent', () => {
  let component: HomeComponent
  let fixture: ComponentFixture<HomeComponent>
  let HttpClientStub: Partial<HttpClient>
  let mortalityService:MortalityService = new MortalityService()
  let birthdayService:BirthdayService = new BirthdayService()
  var dummyElement = document.createElement('div')
  document.getElementById = function(){return dummyElement}

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BirthdayService, PresentValueService, MortalityService, BenefitService, FREDresponse, {provide: HttpClient, useValue: HttpClientStub}, {provide: APP_BASE_HREF, useValue : '/'}],
      declarations: [HomeComponent, AboutComponent, ContactComponent, LegalComponent, ChildinputsComponent, OutputTableComponent, NgForm, NgModel],
      imports: [AppRoutingModule]
    })
    fixture = TestBed.createComponent(HomeComponent)
    component = fixture.componentInstance
    component.scenario = new CalculationScenario()
    component.scenario.discountRate = 1
    component.personA = new Person("A")
    component.personB = new Person("B")
    component.personA.mortalityTable = mortalityService.determineMortalityTable ("male", "SSA", 0) //Using male nonsmoker2 mortality table
    component.personB.mortalityTable = mortalityService.determineMortalityTable ("female", "SSA", 0) //Using female nonsmoker1 mortality table
  })


    it('should be created', () => {
        expect(component).toBeTruthy()
    })


})