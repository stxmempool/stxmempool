import { Component, OnInit, OnDestroy, Input, ChangeDetectionStrategy } from '@angular/core';
import { StateService } from '../../services/state.service';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-stacks-amount',
  templateUrl: './stacks-amount.component.html',
  styleUrls: ['./stacks-amount.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StacksAmountComponent implements OnInit, OnDestroy {
  conversions$: Observable<any>;
  viewFiat$: Observable<boolean>;
  network = '';

  stateSubscription: Subscription;

  @Input() uSTX: number;


  @Input() digitsInfo = '1.8-8';
  @Input() noFiat = false;
  @Input() addPlus = false;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.viewFiat$ = this.stateService.viewFiat$.asObservable();
    this.conversions$ = this.stateService.conversions$.asObservable();
    this.stateSubscription = this.stateService.networkChanged$.subscribe((network) => this.network = network);
  }

  ngOnDestroy() {
    if (this.stateSubscription) {
      this.stateSubscription.unsubscribe();
    }
  }

}
