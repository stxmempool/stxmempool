import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { StateService } from '../../services/state.service';

@Component({
  selector: 'app-stacks-blockchain',
  templateUrl: './stacks-blockchain.component.html',
  styleUrls: ['./stacks-blockchain.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StacksBlockchainComponent implements OnInit, OnDestroy {
  network: string;
  timeLtrSubscription: Subscription;
  timeLtr: boolean = this.stateService.timeLtr.value;
  ltrTransitionEnabled = false;

  constructor(
    public stateService: StateService,
  ) {}

  ngOnInit() {
    this.network = this.stateService.network;
    console.log('this.network', this.network);
    this.timeLtrSubscription = this.stateService.timeLtr.subscribe((ltr) => {
      this.timeLtr = !!ltr;
    });
  }

  ngOnDestroy() {
    this.timeLtrSubscription.unsubscribe();
  }

  toggleTimeDirection() {
    this.ltrTransitionEnabled = true;
    this.stateService.timeLtr.next(!this.timeLtr);
  }
}
