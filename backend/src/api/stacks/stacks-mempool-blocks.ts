import logger from "../../logger";
import config from "../../config";
import {
  StacksTransactionExtended,
  StacksMempoolBlockWithTransactions,
  StacksTransactionStripped,
  StacksMempoolBlockDelta,
  StacksMempoolBlock
  } from './stacks-api.interface';
import { Common } from "../common";


class StacksMempoolBlocks {
  private mempoolBlocks: StacksMempoolBlockWithTransactions[] = [];
  private mempoolBlockDeltas: StacksMempoolBlockDelta[] = [];

  constructor() {}

  getMempoolBlocks(): StacksMempoolBlock[] {
    return this.mempoolBlocks.map((block) => {
      return {
        blockSize: block.blockSize,
        blockVSize: block.blockVSize,
        nTx: block.nTx,
        totalFees: block.totalFees,
        medianFee: block.medianFee,
        feeRange: block.feeRange,
      };
    });
  }

  public getMempoolBlocksWithTransactions(): StacksMempoolBlockWithTransactions[] {
    return this.mempoolBlocks;
  }
  
  public getMempoolBlockDeltas(): StacksMempoolBlockDelta[] {
    return this.mempoolBlockDeltas;
  }

  updateMempoolBlocks (memPool: { [txId: string]: StacksTransactionExtended }): void {
    const latestMempool = memPool;
    const memPoolArray: StacksTransactionExtended[] = [];
    for (const i in latestMempool) {
      if (latestMempool.hasOwnProperty(i)) {
        memPoolArray.push(latestMempool[i]);
      }
    }
    const start = new Date().getTime();

    memPoolArray.sort((a, b) => b.feePerVsize - a.feePerVsize);

    const end = new Date().getTime();
    const time = end - start;
    logger.debug('Stacks Mempool blocks calculated in ' + time / 1000 + ' seconds');

    const { blocks, deltas } = this.calculateMempoolBlocks(memPoolArray, this.mempoolBlocks);

    this.mempoolBlocks = blocks;
    this.mempoolBlockDeltas = deltas;
  }

  private calculateMempoolBlocks(transactionsSorted: StacksTransactionExtended[], prevBlocks: StacksMempoolBlockWithTransactions[]):
    { blocks: StacksMempoolBlockWithTransactions[], deltas: StacksMempoolBlockDelta[]} {
    const mempoolBlocks: StacksMempoolBlockWithTransactions[] = [];
    // const mempoolBlockDeltas: MempoolBlockDelta[] = [];
    /*
      +----------------------+--------------+-----------------+
      |                      | Block Limit  | Read-Only Limit |
      +----------------------+--------------+-----------------+
      | Runtime              | 5000000000   | 1000000000      |
      +----------------------+--------------+-----------------+
      | Read count           | 15000        | 30              |
      +----------------------+--------------+-----------------+
      | Read length (bytes)  | 100000000    | 100000          |
      +----------------------+--------------+-----------------+
      | Write count          | 15000        | 0               |
      +----------------------+--------------+-----------------+
      | Write length (bytes) | 15000000     | 0               |
      +----------------------+--------------+-----------------+
    */
    const mempoolBlockDeltas: any[] = [];
    let blockWeight = 0;
    // let blockRuntime = 0;
    // let blockReadCount = 0;
    // let blockReadLength = 0;
    // let blockWriteCount = 0;
    // let blockWriteLength = 0;
    let blockSize = 0;
    let transactions: StacksTransactionExtended[] = [];
    transactionsSorted.forEach((tx) => {
      if (blockSize + tx.vsize <= config.STACKS.BLOCK_MAX_SIZE
        || mempoolBlocks.length === config.STACKS.MEMPOOL_BLOCKS_AMOUNT - 1) {
          blockSize += tx.vsize;
          transactions.push(tx);
        } else {
          mempoolBlocks.push(this.dataToMempoolBlocks(transactions, blockSize, mempoolBlocks.length));
          blockSize = tx.vsize;
          transactions = [tx];
        }
    });
    if (transactions.length) {
      mempoolBlocks.push(this.dataToMempoolBlocks(transactions, blockSize, mempoolBlocks.length));
    }
    for (let i = 0; i < Math.max(mempoolBlocks.length, prevBlocks.length); i++) {
      // not sure if the txid will be converted from tx_id yet
      let added: StacksTransactionStripped[] = [];
      let removed: string[] = [];
      if (mempoolBlocks[i] && !prevBlocks[i]) {
        added = mempoolBlocks[i].transactions;
      } else if (!mempoolBlocks[i] && prevBlocks[i]) {
        removed = prevBlocks[i].transactions.map(tx => tx.txid);
      } else if (mempoolBlocks[i] && prevBlocks[i]) {
        const prevIds = {};
        const newIds = {};
        prevBlocks[i].transactions.forEach(tx => {
          prevIds[tx.txid] = true;
        });
        mempoolBlocks[i].transactions.forEach(tx => {
          newIds[tx.txid] = true;
        });
        prevBlocks[i].transactions.forEach(tx => {
          if (!newIds[tx.txid]) {
            removed.push(tx.txid);
          }
        });
        mempoolBlocks[i].transactions.forEach(tx => {
          if (!prevIds[tx.txid]) {
            added.push(tx);
          }
        });
      }
      mempoolBlockDeltas.push({
        added,
        removed
      });
    }

    return {
      blocks: mempoolBlocks,
      deltas: mempoolBlockDeltas
    };
  }
  dataToMempoolBlocks(transactions: StacksTransactionExtended[], 
    blockSize: number, blocksIndex: number): StacksMempoolBlockWithTransactions {
    let rangeLength = 4;
    if (blocksIndex === 0) {
      rangeLength = 8;
    }
    if (transactions.length > 4000) {
      rangeLength = 6;
    } else if (transactions.length > 10000) {
      rangeLength = 8;
    }
    return {
      // blockVSize is made up at this point
      // 1,000,000
      // if Max Block Size 2,000,000
      // divide BlockSize by 2,000,000
      // 140000
      // 0.07 * 1000000
      // 070000
      // 631010
      blockVSize: (blockSize / 2000000) * 1000000,
      blockSize: blockSize,
      nTx: transactions.length,
      totalFees: transactions.reduce((acc, cur) => acc + cur.feeRateAsNumber, 0),
      medianFee: Common.percentile(transactions.map((tx) => tx.effectiveFeePerVsize), config.MEMPOOL.RECOMMENDED_FEE_PERCENTILE),
      feeRange: Common.getFeesInRange(transactions, rangeLength),
      transactionIds: transactions.map((tx) => tx.tx_id),
      transactions: transactions.map((tx) => Common.stripStacksTransaction(tx)),
    };
  }
}

export default new StacksMempoolBlocks();