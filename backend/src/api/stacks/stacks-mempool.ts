import config from '../../config';
import loadingIndicators from '../loading-indicators';
import transactionUtils from '../transaction-utils';
import { VbytesPerSecond } from '../../mempool.interfaces';
import { MempoolInfo, StacksTransactionExtended, StacksTransactionStripped } from './stacks-api.interface';
import { Common } from '../common';
import logger from '../../logger';
import stacksApi from './stacks-api';

class StacksMempool {
  private static WEBSOCKET_REFRESH_RATE_MS = 10000;
  private static LAZY_DELETE_AFTER_SECONDS = 30;
  private inSync: boolean = false;
  private mempoolCacheDelta: number = -1;
  private mempoolCache: { [txId: string] : StacksTransactionExtended} = {};
  // fake info as a placeholder because Stacks does not have an equivalent endpoint
  private mempoolInfo: MempoolInfo = { loaded: true, size: 2213, bytes: 739446, usage: 3984000, total_fee: 1,
    maxmempool: 300000000, mempoolminfee: 0.00001000, minrelaytxfee: 0.00001000 };

  private mempoolChangedCallback: ((newMempool: {[txId: string]: StacksTransactionExtended; }, newTransactions: StacksTransactionExtended[],
    deletedTransactions: StacksTransactionExtended[]) => void) | undefined;
  private asyncMempoolChangedCallback: ((newMempool: {[txId: string]: StacksTransactionExtended; }, newTransactions: StacksTransactionExtended[],
    deletedTransactions: StacksTransactionExtended[]) => void) | undefined;
  private txPerSecondArray: number[] = [];
  private txPerSecond: number = 0;

  private vBytesPerSecond: number = 0;
  private vBytesPerSecondArray: VbytesPerSecond[] = [];
  private mempoolProtection = 0;
  private latestTransactions: StacksTransactionStripped[] = [];

  constructor() {
    setInterval(this.updateTxPerSecond.bind(this), 1000);
    setInterval(this.deleteExpiredTransactions.bind(this), 20000);
  }
  /**
   * Return true if we should leave resources available for mempool tx caching
   */
  public hasPriority(): boolean {
    if (this.inSync) {
      return false;
    } else {
      return this.mempoolCacheDelta === -1 || this.mempoolCacheDelta > 25;
    }
  }

  public isInSync(): boolean {
    return this.inSync;
  }

  public setOutOfSync(): void {
    this.inSync = false;
    loadingIndicators.setProgress('mempool', 99);
  }

  public getLatestTransactions(): StacksTransactionStripped[] {
    return this.latestTransactions;
  }

  public setMempoolChangedCallback(fn: (newMempool: { [txId: string]: StacksTransactionExtended; },
    newTransactions: StacksTransactionExtended[], deletedTransactions: StacksTransactionExtended[]) => void): void {
    this.mempoolChangedCallback = fn;
  }
  public setAsyncMempoolChangedCallback(fn: (newMempool: { [txId: string]: StacksTransactionExtended; },
    newTransactions: StacksTransactionExtended[], deletedTransactions: StacksTransactionExtended[]) => Promise<void>): void {
    this.asyncMempoolChangedCallback = fn;
  }

  public getMempool(): { [txid: string]: StacksTransactionExtended } {
    return this.mempoolCache;
  }
  /* Related to loading and setting for diskcache
  public setMempool(mempoolData: { [txId: string]: TransactionExtended }) {
    this.mempoolCache = mempoolData;
    if (this.mempoolChangedCallback) {
      this.mempoolChangedCallback(this.mempoolCache, [], []);
    }
    if (this.asyncMempoolChangedCallback) {
      this.asyncMempoolChangedCallback(this.mempoolCache, [], []);
    }
  }
  */

  /* Related to Mempool info we are not able to replicate
  public async $updateMemPoolInfo() {
    this.mempoolInfo = await this.$getMempoolInfo();
  }
  */
  public getMempoolInfo(): MempoolInfo {
    return this.mempoolInfo;
  }
  public getTxPerSecond(): number {
    return this.txPerSecond;
  }
  public getVBytesPerSecond(): number {
    return this.vBytesPerSecond;
  }


  public async $updateStacksMempool(): Promise<void> {
    logger.debug('Updating Stacks mempool');
    const start = new Date().getTime();
    let hasChange: boolean = false;
    const currentMempoolSize = Object.keys(this.mempoolCache).length;
    const transactions = await stacksApi.$getStacksMempoolTransactions();


    const diff = transactions.length - currentMempoolSize;

    const newTransactions: StacksTransactionExtended[] = [];
    this.mempoolCacheDelta = Math.abs(diff);

    if (!this.inSync) {
      loadingIndicators.setProgress('mempool', Object.keys(this.mempoolCache).length / transactions.length * 100);
    }
    // Experimental algo to speed up intitial mempool sync but will quickly hit rate limits
    if (config.STACKS.DEDICATED_API) {
      try {
        const promiseArray: Promise<StacksTransactionExtended>[] = [];
        for (const txid of transactions) {
          if (!this.mempoolCache[txid]) {
            promiseArray.push(transactionUtils.$getStacksMempoolTransactionExtended(txid));
          }
          if ((new Date().getTime()) - start > StacksMempool.WEBSOCKET_REFRESH_RATE_MS) {
            break;
          }
        }
        const resolvedPromises = await Promise.all(promiseArray);
        resolvedPromises.forEach(tx => this.mempoolCache[tx.tx_id] = tx);
        if (this.inSync) {
          this.txPerSecondArray.push(new Date().getTime());
          resolvedPromises.forEach(tx => {
            this.vBytesPerSecondArray.push({
              unixTime: new Date().getTime(),
              vSize: tx.vsize,
            });
          });
        }
        hasChange = true;
        newTransactions.push(...resolvedPromises);
      } catch (e) {
        logger.debug('Error finding transaction in Stacks mempool: ' + (e instanceof Error ? e.message : e));
      }
    // If using the public node
    } else {
      for (const txid of transactions) {

        if (!this.mempoolCache[txid]) {
          try {
            const transaction: StacksTransactionExtended = await transactionUtils.$getStacksMempoolTransactionExtended(txid);
            this.mempoolCache[txid] = transaction;
            if (this.inSync) {
              this.txPerSecondArray.push(new Date().getTime());
              this.vBytesPerSecondArray.push({
                unixTime: new Date().getTime(),
                vSize: transaction.vsize,
              });
            }
            hasChange = true;
            newTransactions.push(transaction);
          } catch (e) {
            logger.debug('Error finding transaction in Stacks mempool: ' + (e instanceof Error ? e.message : e));
          }
        }
  
        if ((new Date().getTime()) - start > StacksMempool.WEBSOCKET_REFRESH_RATE_MS) {
          break;
        }
      }
    }   

    // Prevent mempool from clear on bitcoind restart by delaying the deletion
    if (this.mempoolProtection === 0
      && currentMempoolSize > 20000
      && transactions.length / currentMempoolSize <= 0.80
    ) {
      this.mempoolProtection = 1;
      this.inSync = false;
      logger.warn(`Mempool clear protection triggered because transactions.length: ${transactions.length} and currentMempoolSize: ${currentMempoolSize}.`);
      setTimeout(() => {
        this.mempoolProtection = 2;
        logger.warn('Mempool clear protection resumed.');
      }, 1000 * 60 * config.MEMPOOL.CLEAR_PROTECTION_MINUTES);
    }

    const deletedTransactions: StacksTransactionExtended[] = [];


    if (this.mempoolProtection !== 1) {
      this.mempoolProtection = 0;
      // Index object for faster search
      const transactionsObject = {};
      transactions.forEach((txId) => transactionsObject[txId] = true);

      // Flag transactions for lazy deletion
      for (const tx in this.mempoolCache) {
        if (!transactionsObject[tx] && !this.mempoolCache[tx].deleteAfter) {
          deletedTransactions.push(this.mempoolCache[tx]);
          this.mempoolCache[tx].deleteAfter = new Date().getTime() + StacksMempool.LAZY_DELETE_AFTER_SECONDS * 1000;
        }
      }
    }

    const newTransactionsStripped = newTransactions.map((tx) => Common.stripStacksTransaction(tx));
    this.latestTransactions = newTransactionsStripped.concat(this.latestTransactions).slice(0, 6);

    if (!this.inSync && transactions.length === Object.keys(this.mempoolCache).length) {
      this.inSync = true;
      logger.notice('The mempool is now in sync!');
      loadingIndicators.setProgress('mempool', 100);
    }

    this.mempoolCacheDelta = Math.abs(transactions.length - Object.keys(this.mempoolCache).length);

    if (this.mempoolChangedCallback && (hasChange || deletedTransactions.length)) {
      this.mempoolChangedCallback(this.mempoolCache, newTransactions, deletedTransactions);
    }
    if (this.asyncMempoolChangedCallback && (hasChange || deletedTransactions.length)) {
      await this.asyncMempoolChangedCallback(this.mempoolCache, newTransactions, deletedTransactions);
    }
    const end = new Date().getTime();
    const time = end - start;
    logger.debug(`Mempool updated in ${time / 1000} seconds. New size: ${Object.keys(this.mempoolCache).length} (${diff > 0 ? '+' + diff : diff})`);
  }

  private updateTxPerSecond(): void {
    const nowMinusTimeSpan = new Date().getTime() - (1000 * config.STATISTICS.TX_PER_SECOND_SAMPLE_PERIOD);
    this.txPerSecondArray = this.txPerSecondArray.filter((unixTime) => unixTime > nowMinusTimeSpan);
    this.txPerSecond = this.txPerSecondArray.length / config.STATISTICS.TX_PER_SECOND_SAMPLE_PERIOD || 0;

    this.vBytesPerSecondArray = this.vBytesPerSecondArray.filter((data) => data.unixTime > nowMinusTimeSpan);
    if (this.vBytesPerSecondArray.length) {
      this.vBytesPerSecond = Math.round(
        this.vBytesPerSecondArray.map((data) => data.vSize).reduce((a, b) => a + b) / config.STATISTICS.TX_PER_SECOND_SAMPLE_PERIOD
      );
    }
  }
  
  private deleteExpiredTransactions(): void {
    const now = new Date().getTime();
    for (const tx in this.mempoolCache) {
      const lazyDeleteAt = this.mempoolCache[tx].deleteAfter;
      if (lazyDeleteAt && lazyDeleteAt < now) {
        delete this.mempoolCache[tx];
      }
    }
  }
}

export default new StacksMempool();