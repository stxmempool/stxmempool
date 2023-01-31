import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { switchMap, filter, catchError, map, tap } from 'rxjs/operators';
// import { Address, Transaction } from '../../interfaces/electrs.interface';
import { WebsocketService } from '../../services/websocket.service';
import { StateService } from '../../services/state.service';
import { AudioService } from '../../services/audio.service';
import { ApiService } from '../../services/api.service';
import { StacksApiService } from '../stacks-api.service';
import { of, merge, Subscription, Observable } from 'rxjs';
import { SeoService } from '../../services/seo.service';
import { AddressInformation } from '../../interfaces/node-api.interface';
import { AddressTransactionsListResponse, AddressBalanceResponse, MempoolTransaction, Transaction } from '@stacks/stacks-blockchain-api-types';
import { StacksTransactionExtended, MinedStacksTransactionExtended } from '../stacks.interfaces';


@Component({
  selector: 'app-stacks-address',
  templateUrl: './stacks-address.component.html',
  styleUrls: ['./stacks-address.component.scss']
})
export class StacksAddressComponent implements OnInit, OnDestroy {
  network = '';

  // address: Address;
  // address: AddressBalanceResponse;
  address: any;

  addressString: string;
  isLoadingAddress = true;
  // transactions: Transaction[];
  // transactions: MinedStacksTransactionExtended[];
  transactions: any[];
  txCount$: Observable<number>;

  isLoadingTransactions = true;
  retryLoadMore = false;
  error: any;
  mainSubscription: Subscription;
  addressLoadingStatus$: Observable<number>;
  addressInfo: null | AddressInformation = null;

  totalConfirmedTxCount = 0;
  loadedConfirmedTxCount = 0;
  txCount = 0;
  received = 0;
  sent = 0;

  // private tempTransactions: Transaction[];
  // private tempTransactions: MinedStacksTransactionExtended[];
  private tempTransactions: any[];


  private timeTxIndexes: number[];
  private lastTransactionTxId: string;

  constructor(
    private route: ActivatedRoute,
    private electrsApiService: ElectrsApiService,
    private websocketService: WebsocketService,
    private stateService: StateService,
    private audioService: AudioService,
    private apiService: ApiService,
    private seoService: SeoService,
    private stacksApiService: StacksApiService
  ) { }

  ngOnInit() {
    this.stateService.networkChanged$.subscribe((network) => this.network = network);
    this.websocketService.want(['blocks']);
   
    this.addressLoadingStatus$ = this.route.paramMap
      .pipe(
        switchMap(() => this.stateService.loadingIndicators$),
        map((indicators) => indicators['address-' + this.addressString] !== undefined ? indicators['address-' + this.addressString] : 0)
      );

    this.mainSubscription = this.route.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          this.error = undefined;
          this.isLoadingAddress = true;
          this.loadedConfirmedTxCount = 0;
          this.address = null;
          this.isLoadingTransactions = true;
          this.transactions = null;
          this.addressInfo = null;
          document.body.scrollTo(0, 0);
          this.addressString = params.get('id') || '';
          if (/^[A-Z]{2,5}1[AC-HJ-NP-Z02-9]{8,100}$/.test(this.addressString)) {
            this.addressString = this.addressString.toLowerCase();
          }
          this.seoService.setTitle($localize`:@@address.component.browser-title:Address: ${this.addressString}:INTERPOLATION:`);

          return merge(
            of(true),
            this.stateService.connectionState$
              .pipe(filter((state) => state === 2 && this.transactions && this.transactions.length > 0))
          )
          .pipe(
            // switchMap(() => this.electrsApiService.getAddress$(this.addressString)
            switchMap(() => this.stacksApiService.getAddress$(this.addressString)

              .pipe(
                catchError((err) => {
                  this.isLoadingAddress = false;
                  this.error = err;
                  console.log(err);
                  return of(null);
                })
              )
            ),
          );
        })
      )
      .pipe(
        filter((address) => !!address),
        tap((address: AddressBalanceResponse) => {
            this.websocketService.startTrackAddress(this.addressString);
        }),
        switchMap((address) => {
          this.address = address;
          this.isLoadingAddress = false;
          this.isLoadingTransactions = true;
          return this.stacksApiService.getAddressTransactions$(this.addressString);

        }),
        switchMap((addressData: { total: number, transactions: (Transaction | MempoolTransaction)[]}) => {
          this.txCount = addressData.total;
          this.tempTransactions = addressData.transactions;
          if (addressData.transactions.length) {
            this.lastTransactionTxId = addressData.transactions[addressData.transactions.length - 1].tx_id;
            this.loadedConfirmedTxCount += addressData.transactions.filter((tx) => tx.tx_status === 'success' || tx.tx_status === 'abort_by_response' || tx.tx_status === 'abort_by_post_condition').length;
          }

          const fetchTxs: string[] = [];
          this.timeTxIndexes = [];
          addressData.transactions.forEach((tx, index) => {
            if (!(tx.tx_status === 'success' || tx.tx_status === 'abort_by_response' || tx.tx_status === 'abort_by_post_condition')) {

              fetchTxs.push(tx.tx_id);
              this.timeTxIndexes.push(index);
            }
          });
          if (!fetchTxs.length) {
            return of([]);
          }
          return this.apiService.getTransactionTimes$(fetchTxs);
        })
      )
      .subscribe((times: number[]) => {
        times.forEach((time, index) => {
          this.tempTransactions[this.timeTxIndexes[index]].firstSeen = time;
        });
        this.tempTransactions.sort((a, b) => {
          if (b.tx_status === 'success' || b.tx_status === 'abort_by_response' || b.tx_status === 'abort_by_post_condition') {
            if (b.block_height === a.block_height) {
              return b.burn_block_time - a.burn_block_time;
            }
            return b.block_height - a.block_height;
          }
          return b.firstSeen - a.firstSeen;
        });

        this.transactions = this.tempTransactions;
        this.isLoadingTransactions = false;
      },
      (error) => {
        console.log(error);
        this.error = error;
        this.isLoadingAddress = false;
      });

    this.stateService.mempoolTransactions$
      .subscribe((transaction) => {
        if (this.transactions.some((t) => t.txid === transaction.txid)) {
          return;
        }

        this.transactions.unshift(transaction);
        this.transactions = this.transactions.slice();
        this.txCount++;

        if (transaction.vout.some((vout) => vout.scriptpubkey_address === this.address.address)) {
          this.audioService.playSound('cha-ching');
        } else {
          this.audioService.playSound('chime');
        }

        transaction.vin.forEach((vin) => {
          if (vin.prevout.scriptpubkey_address === this.address.address) {
            this.sent += vin.prevout.value;
          }
        });
        transaction.vout.forEach((vout) => {
          if (vout.scriptpubkey_address === this.address.address) {
            this.received += vout.value;
          }
        });
      });

    this.stateService.blockTransactions$
      .subscribe((transaction) => {
        const tx = this.transactions.find((t) => t.txid === transaction.txid);
        if (tx) {
          tx.status = transaction.status;
          this.transactions = this.transactions.slice();
          this.audioService.playSound('magic');
        }
        this.totalConfirmedTxCount++;
        this.loadedConfirmedTxCount++;
      });
  }

  loadMore() {
    if (this.isLoadingTransactions || !this.txCount || this.loadedConfirmedTxCount >= this.txCount) {
      return;
    }
    this.isLoadingTransactions = true;
    this.retryLoadMore = false;
    this.stacksApiService.getMoreAddressTransactions$(this.addressString, this.loadedConfirmedTxCount)
      .subscribe((response: { total: number, transactions: (Transaction | MempoolTransaction)[]}) => {
        this.lastTransactionTxId = response.transactions[response.transactions.length - 1].tx_id;
        this.loadedConfirmedTxCount += response.transactions.length;
        this.transactions = this.transactions.concat(response.transactions);
        this.isLoadingTransactions = false;
      },
      (error) => {
        this.isLoadingTransactions = false;
        this.retryLoadMore = true;
      });
  }

  updateChainStats() {
    // this.received = this.address.chain_stats.funded_txo_sum + this.address.mempool_stats.funded_txo_sum;
    // this.sent = this.address.chain_stats.spent_txo_sum + this.address.mempool_stats.spent_txo_sum;
    // this.txCount = this.address.chain_stats.tx_count + this.address.mempool_stats.tx_count;
    // this.totalConfirmedTxCount = this.address.chain_stats.tx_count;
  }

  ngOnDestroy() {
    this.mainSubscription.unsubscribe();
    this.websocketService.stopTrackingAddress();
  }
}
