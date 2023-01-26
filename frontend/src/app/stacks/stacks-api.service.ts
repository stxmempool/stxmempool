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
  // getBlockTransactions$(hash: string, index: number = 0): Observable<Transaction[]> {
  getBlockTransactions$(hash: string, index: number = 0): Observable<MinedStacksTransactionExtended[]> {
    return this.httpClient.get<MinedStacksTransactionExtended[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/stacks/block/' + hash + '/txs/' + index);
  }
  getTransaction$(txId: string): Observable<Transaction> {
    return this.httpClient.get<Transaction>(this.apiBaseUrl + this.apiBasePath + '/api/v1/stacks/tx/' + txId);
  }
  // Address Component
  // getAddress$(address: string): Observable<Address> {
  getAddress$(address: string): Observable<AddressBalanceResponse> {
    return this.httpClient.get<AddressBalanceResponse>(this.apiBaseUrl + this.apiBasePath + '/api/v1/stacks/address/' + address);
  }
  // getAddressTransactions$(address: string): Observable<(MempoolTransaction | Transaction)[]> {
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
    console.log('Base Path', this.apiBasePath);
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

  getTransactionTimes$(txIds: string[]): Observable<number[]> {
    let params = new HttpParams();
    txIds.forEach((txId: string) => {
      params = params.append('txId[]', txId);
    });
    return this.httpClient.get<number[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/transaction-times', { params });
  }

  getOutspendsBatched$(txIds: string[]): Observable<Outspend[][]> {
    let params = new HttpParams();
    txIds.forEach((txId: string) => {
      params = params.append('txId[]', txId);
    });
    return this.httpClient.get<Outspend[][]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/outspends', { params });
  }

  requestDonation$(amount: number, orderId: string): Observable<any> {
    const params = {
      amount: amount,
      orderId: orderId,
    };
    return this.httpClient.post<any>(this.apiBaseUrl + '/api/v1/donations', params);
  }

  getDonation$(): Observable<any[]> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + '/api/v1/donations');
  }

  getTranslators$(): Observable<ITranslators> {
    return this.httpClient.get<ITranslators>(this.apiBaseUrl + '/api/v1/translators');
  }

  getContributor$(): Observable<any[]> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + '/api/v1/contributors');
  }

  checkDonation$(orderId: string): Observable<any[]> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + '/api/v1/donations/check?order_id=' + orderId);
  }

  getInitData$(): Observable<WebsocketResponse> {
    return this.httpClient.get<WebsocketResponse>(this.apiBaseUrl + this.apiBasePath + '/api/v1/init-data');
  }

  getCpfpinfo$(txid: string): Observable<CpfpInfo> {
    return this.httpClient.get<CpfpInfo>(this.apiBaseUrl + this.apiBasePath + '/api/v1/cpfp/' + txid);
  }

  validateAddress$(address: string): Observable<AddressInformation> {
    return this.httpClient.get<AddressInformation>(this.apiBaseUrl + this.apiBasePath + '/api/v1/validate-address/' + address);
  }

  listLiquidPegsMonth$(): Observable<LiquidPegs[]> {
    return this.httpClient.get<LiquidPegs[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/liquid/pegs/month');
  }

  listFeaturedAssets$(): Observable<any[]> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + '/api/v1/assets/featured');
  }

  getAssetGroup$(id: string): Observable<any> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + '/api/v1/assets/group/' + id);
  }

  postTransaction$(hexPayload: string): Observable<any> {
    return this.httpClient.post<any>(this.apiBaseUrl + this.apiBasePath + '/api/tx', hexPayload, { responseType: 'text' as 'json'});
  }

  listPools$(interval: string | undefined) : Observable<any> {
    return this.httpClient.get<any>(
      this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/pools` +
      (interval !== undefined ? `/${interval}` : ''), { observe: 'response' }
    );
  }  

  getPoolStats$(slug: string): Observable<PoolStat> {
    return this.httpClient.get<PoolStat>(this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/pool/${slug}`);
  }

  getPoolHashrate$(slug: string): Observable<any> {
    return this.httpClient.get<any>(this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/pool/${slug}/hashrate`);
  }

  getPoolBlocks$(slug: string, fromHeight: number): Observable<BlockExtended[]> {
    return this.httpClient.get<BlockExtended[]>(
        this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/pool/${slug}/blocks` +
        (fromHeight !== undefined ? `/${fromHeight}` : '')
      );
  }

  getBlocks$(from: number): Observable<BlockExtended[]> {
    return this.httpClient.get<BlockExtended[]>(
      this.apiBaseUrl + this.apiBasePath + `/api/v1/blocks` +
      (from !== undefined ? `/${from}` : ``)
    );
  }

  getBlock$(hash: string): Observable<StacksBlockExtended> {
    return this.httpClient.get<StacksBlockExtended>(this.apiBaseUrl + this.apiBasePath + '/api/v1/stacks/block/' + hash);
  }

  getStrippedBlockTransactions$(hash: string): Observable<StacksTransactionStripped[]> {
    return this.httpClient.get<StacksTransactionStripped[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/stacks/block/' + hash + '/summary');
  }

  getDifficultyAdjustments$(interval: string | undefined): Observable<any> {
    return this.httpClient.get<any[]>(
        this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/difficulty-adjustments` +
        (interval !== undefined ? `/${interval}` : ''), { observe: 'response' }
      );
  }

  getHistoricalHashrate$(interval: string | undefined): Observable<any> {
    return this.httpClient.get<any[]>(
        this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/hashrate` +
        (interval !== undefined ? `/${interval}` : ''), { observe: 'response' }
      );
  }

  getHistoricalPoolsHashrate$(interval: string | undefined): Observable<any> {
    return this.httpClient.get<any[]>(
        this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/hashrate/pools` +
        (interval !== undefined ? `/${interval}` : ''), { observe: 'response' }
      );
  }

  getHistoricalBlockFees$(interval: string | undefined) : Observable<any> {
    return this.httpClient.get<any[]>(
      this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/blocks/fees` +
      (interval !== undefined ? `/${interval}` : ''), { observe: 'response' }
    );
  }

  getHistoricalBlockRewards$(interval: string | undefined) : Observable<any> {
    return this.httpClient.get<any[]>(
      this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/blocks/rewards` +
      (interval !== undefined ? `/${interval}` : ''), { observe: 'response' }
    );
  }

  getHistoricalBlockFeeRates$(interval: string | undefined) : Observable<any> {
    return this.httpClient.get<any[]>(
      this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/blocks/fee-rates` +
      (interval !== undefined ? `/${interval}` : ''), { observe: 'response' }
    );
  }

  getHistoricalBlockSizesAndWeights$(interval: string | undefined) : Observable<any> {
    return this.httpClient.get<any[]>(
      this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/blocks/sizes-weights` +
      (interval !== undefined ? `/${interval}` : ''), { observe: 'response' }
    );
  }

  getHistoricalBlockPrediction$(interval: string | undefined) : Observable<any> {
    return this.httpClient.get<any[]>(
      this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/blocks/predictions` +
      (interval !== undefined ? `/${interval}` : ''), { observe: 'response' }
    );
  }

  getBlockAudit$(hash: string) : Observable<any> {
    return this.httpClient.get<any>(
      this.apiBaseUrl + this.apiBasePath + `/api/v1/block/${hash}/audit-summary`, { observe: 'response' }
    );
  }

  getBlockAuditScores$(from: number): Observable<AuditScore[]> {
    return this.httpClient.get<AuditScore[]>(
      this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/blocks/audit/scores` +
      (from !== undefined ? `/${from}` : ``)
    );
  }

  getBlockAuditScore$(hash: string) : Observable<any> {
    return this.httpClient.get<any>(
      this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/blocks/audit/score/` + hash
    );
  }

  getRewardStats$(blockCount: number = 144): Observable<RewardStats> {
    return this.httpClient.get<RewardStats>(this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/reward-stats/${blockCount}`);
  }

  getEnterpriseInfo$(name: string): Observable<any> {
    return this.httpClient.get<any>(this.apiBaseUrl + this.apiBasePath + `/api/v1/enterprise/info/` + name);
  }

  getChannelByTxIds$(txIds: string[]): Observable<any[]> {
    let params = new HttpParams();
    txIds.forEach((txId: string) => {
      params = params.append('txId[]', txId);
    });
    return this.httpClient.get<any[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/channels/txids/', { params });
  }

  lightningSearch$(searchText: string): Observable<any[]> {
    let params = new HttpParams().set('searchText', searchText);
    return this.httpClient.get<any[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/search', { params });
  }

  getNodesPerIsp(): Observable<any> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/nodes/isp-ranking');
  }

  getNodeForCountry$(country: string): Observable<any> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/nodes/country/' + country);
  }

  getNodeForISP$(isp: string): Observable<any> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/nodes/isp/' + isp);
  }

  getNodesPerCountry$(): Observable<any> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/nodes/countries');
  }

  getWorldNodes$(): Observable<any> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/nodes/world');
  }

  getChannelsGeo$(publicKey?: string, style?: 'graph' | 'nodepage' | 'widget' | 'channelpage'): Observable<any> {
    return this.httpClient.get<any[]>(
      this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/channels-geo' +
        (publicKey !== undefined ? `/${publicKey}`   : '') +
        (style     !== undefined ? `?style=${style}` : '')
    );
  }
}