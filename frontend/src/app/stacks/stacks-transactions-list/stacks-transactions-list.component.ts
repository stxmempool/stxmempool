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


/*
  Types of transactions = tx_type
    - Contract Call
    - Token Transfer
    - Coinbase
    - Smart Contract
    - Poison Microblock
  Token Transfer
    - Transaction Id = tx_id
    - Sender Address = sender_address
    - Receipient Address = token_transfer?.recipient_address
    - Amount/ Value = token_transfer?amount (type string)
    - Fee = feeRateAsNumber
    - Successfull = tx_status
  Contract Call
    - Function name = .contract_call.function_name
    - Result = tx_status = 'success'
    - Fees = fee_rate
  Smart Contract
    - 
*/

@Component({
  selector: 'app-stacks-transactions-list',
  templateUrl: './stacks-transactions-list.component.html',
  styleUrls: ['./stacks-transactions-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StacksTransactionsListComponent implements OnInit, OnChanges {
// export class StacksTransactionsListComponent implements OnInit {

  network = '';
  nativeAssetId = this.stateService.network === 'liquidtestnet' ? environment.nativeTestAssetId : environment.nativeAssetId;
  showMoreIncrement = 1000;

  // @Input() transactions: Transaction[];
  // @Input() transactions: StacksTransactionExtended[];
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
  // latestBlock$: Observable<StacksBlockExtended>;
  latestBlock$: Observable<any>;


  outspendsSubscription: Subscription;
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
    private apiService: ApiService,
    // private assetsService: AssetsService,
    private ref: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    this.latestBlock$ = this.stateService.blocks$.pipe(map(([block]) => block));
    // this.latestBlock$ = this.stateService.stacksBlocks$.pipe(map(([block]) => block));

    this.stateService.networkChanged$.subscribe((network) => this.network = network);

    // if (this.network === 'liquid' || this.network === 'liquidtestnet') {
    //   this.assetsService.getAssetsMinimalJson$.subscribe((assets) => {
    //     this.assetsMinimal = assets;
    //   });
    // }

    // this.outspendsSubscription = merge(
    //   this.refreshOutspends$
    //     .pipe(
    //       switchMap((txIds) => this.apiService.getOutspendsBatched$(txIds)),
    //       tap((outspends: Outspend[][]) => {
    //         if (!this.transactions) {
    //           return;
    //         }
    //         const transactions = this.transactions.filter((tx) => !tx._outspends);
    //         outspends.forEach((outspend, i) => {
    //           transactions[i]._outspends = outspend;
    //         });
    //       }),
    //     ),
    //   this.stateService.utxoSpent$
    //     .pipe(
    //       tap((utxoSpent) => {
    //         for (const i in utxoSpent) {
    //           this.transactions[0]._outspends[i] = {
    //             spent: true,
    //             txid: utxoSpent[i].txid,
    //             vin: utxoSpent[i].vin,
    //           };
    //         }
    //       }),
    //     ),
    //     this.refreshChannels$
    //       .pipe(
    //         filter(() => this.stateService.env.LIGHTNING),
    //         switchMap((txIds) => this.apiService.getChannelByTxIds$(txIds)),
    //         tap((channels) => {
    //           const transactions = this.transactions.filter((tx) => !tx._channels);
    //           channels.forEach((channel, i) => {
    //             transactions[i]._channels = channel;
    //           });
    //         }),
    //       )
    //     ,
    // ).subscribe(() => this.ref.markForCheck());
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

      // this.transactions.forEach((tx) => {
      //   tx['@voutLimit'] = true;
      //   tx['@vinLimit'] = true;
      //   if (tx['addressValue'] !== undefined) {
      //     return;
      //   }

      //   if (this.address) {
      //     const addressIn = tx.vout
      //       .filter((v: Vout) => v.scriptpubkey_address === this.address)
      //       .map((v: Vout) => v.value || 0)
      //       .reduce((a: number, b: number) => a + b, 0);

      //     const addressOut = tx.vin
      //       .filter((v: Vin) => v.prevout && v.prevout.scriptpubkey_address === this.address)
      //       .map((v: Vin) => v.prevout.value || 0)
      //       .reduce((a: number, b: number) => a + b, 0);

      //     tx['addressValue'] = addressIn - addressOut;
      //   }
      // });
      // const txIds = this.transactions.filter((tx) => !tx._outspends).map((tx) => tx.txid);
      // if (txIds.length) {
      //   this.refreshOutspends$.next(txIds);
      // }
      // if (this.stateService.env.LIGHTNING) {
      //   const txIds = this.transactions.filter((tx) => !tx._channels).map((tx) => tx.txid);
      //   if (txIds.length) {
      //     this.refreshChannels$.next(txIds);
      //   }
      // }
    }
  }

  onScroll(): void {
    const scrollHeight = document.body.scrollHeight;
    const scrollTop = document.documentElement.scrollTop;
    if (scrollHeight > 0){
      const percentageScrolled = scrollTop * 100 / scrollHeight;
      if (percentageScrolled > 70){
        console.log(percentageScrolled);
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
    // return tx.txid + tx.status.confirmed;
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

  // ngOnDestroy(): void {
  //   this.outspendsSubscription.unsubscribe();
  // }
}