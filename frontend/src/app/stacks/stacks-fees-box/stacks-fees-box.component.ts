import { Component, OnInit, ChangeDetectionStrategy, Input } from '@angular/core';
import { StateService } from '../../services/state.service';
import { Observable } from 'rxjs';
import { Recommendedfees } from '../../interfaces/websocket.interface';
import { feeLevels, mempoolFeeColors } from '../../app.constants';
import { tap } from 'rxjs/operators';

@Component({
  selector: 'app-stacks-fees-box',
  templateUrl: './stacks-fees-box.component.html',
  styleUrls: ['./stacks-fees-box.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StacksFeesBoxComponent implements OnInit {
  isLoadingWebSocket$: Observable<boolean>;
  recommendedFees$: Observable<any>;
  gradient = 'linear-gradient(to right, #2e324e, #2e324e)';
  noPriority = '#2e324e';
  feeRounding = '1.0-0';
  @Input() type: string;

  constructor(
    private stateService: StateService
  ) { }

  ngOnInit(): void {
    this.isLoadingWebSocket$ = this.stateService.isLoadingWebSocket$;
    this.recommendedFees$ = this.stateService.recommendedFees$
      .pipe(
        tap((fees) => {
          let feeLevelIndex = feeLevels.slice().reverse().findIndex((feeLvl) => fees.minimumFee >= feeLvl);
          feeLevelIndex = feeLevelIndex >= 0 ? feeLevels.length - feeLevelIndex : feeLevelIndex;
          const startColor = '#' + (mempoolFeeColors[feeLevelIndex - 1] || mempoolFeeColors[mempoolFeeColors.length - 1]);

          feeLevelIndex = feeLevels.slice().reverse().findIndex((feeLvl) => fees.fastestFee >= feeLvl);
          feeLevelIndex = feeLevelIndex >= 0 ? feeLevels.length - feeLevelIndex : feeLevelIndex;
          const endColor = '#' + (mempoolFeeColors[feeLevelIndex - 1] || mempoolFeeColors[mempoolFeeColors.length - 1]);

          this.gradient = `linear-gradient(to right, ${startColor}, ${endColor})`;
          this.noPriority = startColor;
        }
      )
    );
  }
}
