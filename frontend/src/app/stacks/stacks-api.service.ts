import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { CpfpInfo, OptimizedMempoolStats, AddressInformation, LiquidPegs, ITranslators,
  PoolStat, BlockExtended, TransactionStripped, RewardStats, AuditScore } from '../interfaces/node-api.interface';
import { Observable } from 'rxjs';
import { StateService } from '../services/state.service';
import { WebsocketResponse } from '../interfaces/websocket.interface';
import { Outspend } from '../interfaces/electrs.interface';
import { StacksBlockExtended, StacksTransactionStripped, MinedStacksTransactionExtended } from './stacks.interfaces';
import { Transaction, AddressBalanceResponse, MempoolTransaction, SearchSuccessResult } from '@stacks/stacks-blockchain-api-types';
@Injectable({
  providedIn: 'root'
})
export class StacksApiService {
  private apiBaseUrl: string; // base URL is protocol, hostname, and port
  private apiBasePath: string; // network path is /testnet, etc. or '' for mainnet

  constructor(
    private httpClient: HttpClient,
    private stateService: StateService,
  ) {
    this.apiBaseUrl = ''; // use relative URL by default
    if (!stateService.isBrowser) { // except when inside AU SSR process
      this.apiBaseUrl = this.stateService.env.NGINX_PROTOCOL + '://' + this.stateService.env.NGINX_HOSTNAME + ':' + this.stateService.env.NGINX_PORT;
    }
    this.apiBasePath = ''; // assume mainnet by default
    this.stateService.networkChanged$.subscribe((network) => {
      if (network === 'bisq' && !this.stateService.env.BISQ_SEPARATE_BACKEND) {
        network = '';
      }
      this.apiBasePath = network ? '/' + network : '';
    });
  }

  getBlockTransactions$(hash: string, index: number = 0): Observable<MinedStacksTransactionExtended[]> {
    return this.httpClient.get<MinedStacksTransactionExtended[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/stacks/block/' + hash + '/txs/' + index);
  }

  getTransaction$(txId: string): Observable<Transaction> {
    return this.httpClient.get<Transaction>(this.apiBaseUrl + this.apiBasePath + '/api/v1/stacks/tx/' + txId);
  }

  getAddress$(address: string): Observable<AddressBalanceResponse> {
    return this.httpClient.get<AddressBalanceResponse>(this.apiBaseUrl + this.apiBasePath + '/api/v1/stacks/address/' + address);
  }

  getAddressTransactions$(address: string): Observable<{ total: number, transactions: (Transaction | MempoolTransaction)[]}> {
    return this.httpClient.get<{ total: number, transactions: (Transaction | MempoolTransaction)[]}>(this.apiBaseUrl + this.apiBasePath + '/api/v1/stacks/address/' + address + '/txs');
  }

  getMoreAddressTransactions$(address: string, offset: number): Observable<{ total: number, transactions: (Transaction | MempoolTransaction)[]}> {
    return this.httpClient.get<{ total: number, transactions: (Transaction | MempoolTransaction)[]}>(this.apiBaseUrl + this.apiBasePath + '/api/v1/stacks/address/' + address + '/txs/' + offset);
  }

  getAddressesByPrefix$(prefix: string): Observable<string[]> {
    if (prefix.toLowerCase().indexOf('bc1') === 0) {
      prefix = prefix.toLowerCase();
    }
    return this.httpClient.get<string[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/stacks/address-prefix/' + prefix);
  }

  searchStacksApi$(id: string): Observable<SearchSuccessResult> {
    return this.httpClient.get<SearchSuccessResult>(`https://stacks-node-api.mainnet.stacks.co/extended/v1/search/${id}`);
  }

  getBlockHashFromHeight$(height: number): Observable<string> {
    return this.httpClient.get(this.apiBaseUrl + this.apiBasePath + '/api/v1/stacks/block-height/' + height, {responseType: 'text'});
  }

  list2HStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/2h');
  }

  list24HStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/24h');
  }

  list1WStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/1w');
  }

  list1MStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/1m');
  }

  list3MStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/3m');
  }

  list6MStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/6m');
  }

  list1YStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/1y');
  }

  list2YStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/2y');
  }

  list3YStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/3y');
  }

  getInitData$(): Observable<WebsocketResponse> {
    return this.httpClient.get<WebsocketResponse>(this.apiBaseUrl + this.apiBasePath + '/api/v1/init-data');
  }


  getBlock$(hash: string): Observable<StacksBlockExtended> {
    return this.httpClient.get<StacksBlockExtended>(this.apiBaseUrl + this.apiBasePath + '/api/v1/stacks/block/' + hash);
  }

  getStrippedBlockTransactions$(hash: string): Observable<StacksTransactionStripped[]> {
    return this.httpClient.get<StacksTransactionStripped[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/stacks/block/' + hash + '/summary');
  }

}
