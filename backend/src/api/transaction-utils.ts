import bitcoinApi from './bitcoin/bitcoin-api-factory';
import stacksApi from './stacks/stacks-api';
import { TransactionExtended, TransactionMinerInfo } from '../mempool.interfaces';
import { IEsploraApi } from './bitcoin/esplora-api.interface';
import { Transaction, MempoolTransaction } from '@stacks/stacks-blockchain-api-types';
import { ExtendedStacksTransaction } from './stacks/stacks-api.interface';


import config from '../config';
import { Common } from './common';

class TransactionUtils {
  constructor() { }

  public stripCoinbaseTransaction(tx: TransactionExtended): TransactionMinerInfo {
    return {
      vin: [{
        scriptsig: tx.vin[0].scriptsig || tx.vin[0]['coinbase']
      }],
      vout: tx.vout
        .map((vout) => ({
          scriptpubkey_address: vout.scriptpubkey_address,
          value: vout.value
        }))
        .filter((vout) => vout.value)
    };
  }

  public async $getTransactionExtended(txId: string, addPrevouts = false, lazyPrevouts = false): Promise<TransactionExtended> {
    const transaction: IEsploraApi.Transaction = await bitcoinApi.$getRawTransaction(txId, false, addPrevouts, lazyPrevouts);
    return this.extendTransaction(transaction);
  }

  public async $getStacksTransactionExtended(txId: string, verboseTransaction: Transaction | MempoolTransaction): Promise<ExtendedStacksTransaction> {
    // const transaction = await stacksApi.$getTransaction(txId);
    const size = await stacksApi.$getTransactionSize(txId);
    // return this.extendStacksTransaction(transaction, size);
    return this.extendStacksTransaction(verboseTransaction, size);

  }
  public async $getStacksMempoolTransactionExtended(txId: string): Promise<ExtendedStacksTransaction> {
    const transaction = await stacksApi.$getTransaction(txId);
    const size = await stacksApi.$getTransactionSize(txId);
    return this.extendStacksTransaction(transaction, size);
    // return this.extendStacksTransaction(verboseTransaction, size);

  }

  private extendTransaction(transaction: IEsploraApi.Transaction): TransactionExtended {
    // @ts-ignore
    if (transaction.vsize) {
      // @ts-ignore
      return transaction;
    }
    const feePerVbytes = Math.max(Common.isLiquid() ? 0.1 : 1,
      (transaction.fee || 0) / (transaction.weight / 4));
    const transactionExtended: TransactionExtended = Object.assign({
      vsize: Math.round(transaction.weight / 4),
      feePerVsize: feePerVbytes,
      effectiveFeePerVsize: feePerVbytes,
    }, transaction);
    if (!transaction.status.confirmed) {
      transactionExtended.firstSeen = Math.round((new Date().getTime() / 1000));
    }
    return transactionExtended;
  }

  public extendStacksTransaction (transaction: Transaction | MempoolTransaction, size: number): ExtendedStacksTransaction {
    // @ts-ignore
    if (transaction.vsize) {
      // @ts-ignore
      return transaction;
    }
    const feePerVbytes = Math.max(1, (Number(transaction.fee_rate) || 0) / size);
    const transactionExtended: ExtendedStacksTransaction = Object.assign({
      feeRateAsNumber: Number(transaction.fee_rate),
      vsize: size,
      feePerVsize: feePerVbytes,
      effectiveFeePerVsize: feePerVbytes,
      firstSeen: 1,
    }, transaction);
    if (transaction.tx_status === 'pending') {
      transactionExtended['firstSeen'] = Math.round((new Date().getTime() / 1000));
    }
    return transactionExtended;
  }

  public hex2ascii(hex: string) {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
  }
}

export default new TransactionUtils();
