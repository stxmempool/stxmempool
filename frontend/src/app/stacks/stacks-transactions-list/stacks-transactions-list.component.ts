import { Component, OnInit, Input, ChangeDetectionStrategy, OnChanges, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { StateService } from '../../services/state.service';
import { Observable, ReplaySubject, BehaviorSubject, merge, Subscription } from 'rxjs';
import { Outspend, Transaction, Vin, Vout } from '../../interfaces/electrs.interface';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { environment } from '../../../environments/environment';
import { AssetsService } from '../../services/assets.service';
import { filter, map, tap, switchMap } from 'rxjs/operators';
import { BlockExtended } from '../../interfaces/node-api.interface';
import { StacksTransactionExtended, MinedStacksTransactionExtended, StacksBlockExtended } from '../stacks.interfaces';
import { ApiService } from '../../services/api.service';
import { MempoolTransaction } from '@stacks/stacks-blockchain-api-types';


@Component({
  selector: 'app-stacks-transactions-list',
  templateUrl: './stacks-transactions-list.component.html',
  styleUrls: ['./stacks-transactions-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StacksTransactionsListComponent implements OnInit, OnChanges {

  network = '';
  nativeAssetId = this.stateService.network === 'liquidtestnet' ? environment.nativeTestAssetId : environment.nativeAssetId;
  showMoreIncrement = 1000;

  @Input() transactions: MinedStacksTransactionExtended[];


  @Input() showConfirmations = false;
  @Input() transactionPage = false;
  @Input() errorUnblinded = false;
  @Input() paginated = false;
  @Input() inputIndex: number;
  @Input() outputIndex: number;
  @Input() address: string = '';
  @Input() rowLimit = 12;

  @Output() loadMore = new EventEmitter();

  // latestBlock$: Observable<BlockExtended>;
  latestBlock$: Observable<any>;


  // outspendsSubscription: Subscription;
  refreshOutspends$: ReplaySubject<string[]> = new ReplaySubject();
  refreshChannels$: ReplaySubject<string[]> = new ReplaySubject();
  showDetails$ = new BehaviorSubject<boolean>(false);
  assetsMinimal: any;
  transactionsLength: number = 0;
  inputRowLimit: number = 12;
  outputRowLimit: number = 12;

  constructor(
    public stateService: StateService,
    private electrsApiService: ElectrsApiService,
    private ref: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    this.latestBlock$ = this.stateService.blocks$.pipe(map(([block]) => block));

    this.stateService.networkChanged$.subscribe((network) => this.network = network);
  }

  ngOnChanges(changes): void {
    if (changes.inputIndex || changes.outputIndex || changes.rowLimit) {
      this.inputRowLimit = Math.max(this.rowLimit, (this.inputIndex || 0) + 3);
      this.outputRowLimit = Math.max(this.rowLimit, (this.outputIndex || 0) + 3);
      if ((this.inputIndex || this.outputIndex) && !changes.transactions) {
        setTimeout(() => {
          const assetBoxElements = document.getElementsByClassName('assetBox');
          if (assetBoxElements && assetBoxElements[0]) {
            assetBoxElements[0].scrollIntoView({block: "center"});
          }
        }, 10);
      }
    }
    if (changes.transactions || changes.address) {
      if (!this.transactions || !this.transactions.length) {
        return;
      }

      this.transactionsLength = this.transactions.length;
      this.stateService.setTxCache(this.transactions);
    }
  }

  onScroll(): void {
    const scrollHeight = document.body.scrollHeight;
    const scrollTop = document.documentElement.scrollTop;
    if (scrollHeight > 0){
      const percentageScrolled = scrollTop * 100 / scrollHeight;
      if (percentageScrolled > 70){
        this.loadMore.emit();
      }
    }
  }

  haveBlindedOutputValues(tx: Transaction): boolean {
    return tx.vout.some((v: any) => v.value === undefined);
  }

  getTotalTxOutput(tx: Transaction): number {
    return tx.vout.map((v: Vout) => v.value || 0).reduce((a: number, b: number) => a + b);
  }

  switchCurrency(): void {
    if (this.network === 'liquid' || this.network === 'liquidtestnet') {
      return;
    }
    const oldvalue = !this.stateService.viewFiat$.value;
    this.stateService.viewFiat$.next(oldvalue);
  }

  trackByFn(index: number, tx: StacksTransactionExtended): string {
    const bool = tx.tx_status === 'success';
    return tx.tx_id + bool;
  }

  trackByIndexFn(index: number): number {
    return index;
  }
  convertStrToNum(string: string): number {
    return Number(string);
  }

  formatHex(num: number): string {
    const str = num.toString(16);
    return '0x' + (str.length % 2 ? '0' : '') + str;
  }

  pow(base: number, exponent: number): number {
    return Math.pow(base, exponent);
  }

  toggleDetails(): void {
    if (this.showDetails$.value === true) {
      this.showDetails$.next(false);
    } else {
      this.showDetails$.next(true);
    }
  }

  loadMoreInputs(tx: Transaction): void {
    if (!tx['@vinLoaded']) {
      this.electrsApiService.getTransaction$(tx.txid)
        .subscribe((newTx) => {
          tx['@vinLoaded'] = true;
          tx.vin = newTx.vin;
          tx.fee = newTx.fee;
          this.ref.markForCheck();
        });
    }
  }

  showMoreInputs(tx: Transaction): void {
    this.loadMoreInputs(tx);
    tx['@vinLimit'] = this.getVinLimit(tx, true);
  }

  showMoreOutputs(tx: Transaction): void {
    tx['@voutLimit'] = this.getVoutLimit(tx, true);
  }

  getVinLimit(tx: Transaction, next = false): number {
    let limit;
    if ((tx['@vinLimit'] || 0) > this.inputRowLimit) {
      limit = Math.min(tx['@vinLimit'] + (next ? this.showMoreIncrement : 0), tx.vin.length);
    } else {
      limit = Math.min((next ? this.showMoreIncrement : this.inputRowLimit), tx.vin.length);
    }
    if (tx.vin.length - limit <= 5) {
      limit = tx.vin.length;
    }
    return limit;
  }
  convertStringToInt(str: string): number {
    return Number(str);
  }

  getVoutLimit(tx: Transaction, next = false): number {
    let limit;
    if ((tx['@voutLimit'] || 0) > this.outputRowLimit) {
      limit = Math.min(tx['@voutLimit'] + (next ? this.showMoreIncrement : 0), tx.vout.length);
    } else {
      limit = Math.min((next ? this.showMoreIncrement : this.outputRowLimit), tx.vout.length);
    }
    if (tx.vout.length - limit <= 5) {
      limit = tx.vout.length;
    }
    return limit;
  }
  parseContractName (contractId: string): string {
    return contractId.slice(contractId.indexOf('.') + 1);
  }
}
