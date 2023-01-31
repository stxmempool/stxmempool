import logger from '../../logger';
import config from '../../config';
import {
  StacksTransactionExtended,
  StacksMempoolBlockWithTransactions,
  StacksTransactionStripped,
  StacksMempoolBlockDelta,
  StacksMempoolBlock,
  ProjectedMempoolBlock
  } from './stacks-api.interface';
import { Common } from '../common';


class StacksMempoolBlocks {
  private mempoolBlocks: StacksMempoolBlockWithTransactions[] = [];
  private mempoolBlockDeltas: StacksMempoolBlockDelta[] = [];
  private mempoolProjectedCache: { [txId: string] : StacksTransactionExtended} = {};
  private mempoolProjectedBlock: ProjectedMempoolBlock = {
    tx_ids: [],
    blockDetails: {
      Miner: '',
      tx_count: 0,
      block_size: 0,
      execution_consumed : {
        runtime: 0,
        write_len: 0, 
        write_cnt: 0, 
        read_len: 0,
        read_cnt: 0,
      },
      percentage: 0,
      tx_fees_microstacks: 0
    },
    transactions: []
  };

  // constructor() {}

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
  public getProjectedBlock(): StacksMempoolBlock {
    return {
      blockSize: this.mempoolProjectedBlock.blockDetails.block_size,
      blockVSize: this.mempoolProjectedBlock.blockDetails.block_size,
      nTx: this.mempoolProjectedBlock.tx_ids.length,
      totalFees: this.mempoolProjectedBlock.blockDetails.tx_fees_microstacks,
      medianFee: Common.percentile(this.mempoolProjectedBlock.tx_ids.map((tx) => tx.effectiveFeePerVsize), config.MEMPOOL.RECOMMENDED_FEE_PERCENTILE),
      feeRange: Common.getFeesInRange(this.mempoolProjectedBlock.tx_ids, 8),
    };
}

  public getMempoolBlocksWithTransactions(): StacksMempoolBlockWithTransactions[] {
    return this.mempoolBlocks;
  }
  public getProjectedBlockWithTransactions(): ProjectedMempoolBlock {
    return this.mempoolProjectedBlock;
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
    const mempoolBlockDeltas: StacksMempoolBlockDelta[] = [];

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