import logger from '../../logger';
import config from '../../config';
import {
  StacksTransactionExtended,
  StacksMempoolBlockWithTransactions,
  StacksTransactionStripped,
  StacksMempoolBlockDelta,
  StacksMempoolBlock,
  RawProjectedMempoolBlock,
  ProjectedMempoolBlockDetails,
  ProjectedMempoolBlock
  } from './stacks-api.interface';
import { Common } from '../common';
import { execFile } from 'child_process';
// import * as fs from 'fs';
import * as fs from 'fs';

import { join } from 'path';
import util from 'util';
import transactionUtils from '../transaction-utils';


class StacksMempoolBlocks {
  private mempoolBlocks: StacksMempoolBlockWithTransactions[] = [];
  private mempoolBlockDeltas: StacksMempoolBlockDelta[] = [];
  private mempoolProjectedCache: { [txId: string] : StacksTransactionExtended} = {};
  // private mempoolProjectedBlock: any = {
  //   tx_ids: []
  // };
  // private mempoolProjectedBlock: {
  //   [tx_ids: string]: StacksTransactionExtended[];
  //   blockDetails: {ProjectedMempoolBlockDetails}
  // } = {};
  // private mempoolProjectedBlock: {
  //   tx_ids: StacksTransactionExtended[];
  //   blockDetails: ProjectedMempoolBlockDetails;
  //   transactions: StacksTransactionStripped[]
  // } = {
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
  }

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
  public getProjectedBlockWithTransactions() {
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
    // blocks.unshift(this.mempoolProjectedBlock);
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

  public async updateProjection() {
    const projectedBlockRaw = await this.runProjection();
    // const newTransactions: StacksTransactionExtended[] = [];
    console.log('projectedBlockRaw-->', projectedBlockRaw);
    if (projectedBlockRaw.tx_ids.length === 1 && projectedBlockRaw.blockDetails) {
      this.mempoolProjectedBlock.blockDetails = projectedBlockRaw.blockDetails;
      //@ts-ignore
      this.mempoolProjectedBlock.tx_ids = [{
        tx_id: projectedBlockRaw.tx_ids[0],
        firstSeen: Date.now(),
        nonce: 0,
        fee_rate: '0',
        feeRateAsNumber: 0,
        vsize: 150,
        // type: 'coinbase',
        execution_cost_read_count: 0,
        effectiveFeePerVsize: 0,
        feePerVsize: 0,
      }];
      this.mempoolProjectedBlock.transactions = [{
        txid: projectedBlockRaw.tx_ids[0],
        fee: 0,
        vsize: 150,
        type: 'coinbase',
        execution_cost_read_count: 0,
      }];
    } else {
      projectedBlockRaw.tx_ids.shift();

      for(const txid of projectedBlockRaw.tx_ids) {
        try {
          const transaction: StacksTransactionExtended = await transactionUtils.$getStacksMempoolTransactionExtended(txid);
          this.mempoolProjectedBlock.tx_ids.push(transaction);
          // newTransactions.push(transaction);
        } catch (e) {
          logger.debug('Error finding transaction in projected Stacks Mempool Block: ' + (e instanceof Error ? e.message : e));
        }
        // if (!this.mempoolProjectedCache[txid]) {
        //   try {
        //     const transaction: StacksTransactionExtended = await transactionUtils.$getStacksMempoolTransactionExtended(txid);
        //     this.mempoolProjectedCache[txid] = transaction;
        //     newTransactions.push(transaction);
        //   } catch (e) {
        //     logger.debug('Error finding transaction in projected Stacks Mempool Block: ' + (e instanceof Error ? e.message : e));
        //   }
        // }
      }
      // newTransactions.sort((a, b) => b.feePerVsize - a.feePerVsize);
      // console.log('this.mempoolProjectedBlock.tx_ids', this.mempoolProjectedBlock.tx_ids)
      this.mempoolProjectedBlock.tx_ids.sort((a, b) => b.feePerVsize - a.feePerVsize);
      if (projectedBlockRaw.blockDetails) {
        this.mempoolProjectedBlock.blockDetails = projectedBlockRaw.blockDetails;
      }
      this.mempoolProjectedBlock.transactions = this.mempoolProjectedBlock.tx_ids.map((tx) => Common.stripStacksTransaction(tx));
      // const newTransactionsStripped = newTransactions.map((tx) => Common.stripStacksTransaction(tx));
      // console.log('this.mempoolProjectedBlock', this.mempoolProjectedBlock)
    }
  }
  public async runProjection(): Promise<RawProjectedMempoolBlock> {
    const exec = util.promisify(execFile);
    const obj: RawProjectedMempoolBlock = {
      tx_ids: [],
    };
    // const txArray: string[] = [];
    try {
      const { stdout, stderr } = await exec('/Users/walterdevault/Stacks/stacks-blockchain/target/debug/stacks-inspect', ['try-mine', '/Users/walterdevault/Stacks/stacks-blockchain/testnet/stacks-node/mainnet/', '10', '30000']);
      const array = stderr.split('\n');
      array.push(stdout);
      let blockDetails = '{';
      for (let i = 0; i < array.length; i++) {
        if(array[i].includes('rs:1614')) {
          // @ts-ignore
          // txArray.push(array[i].match(/(?<=x: )(.*?)(?=,)/g)[0]);
          obj.tx_ids.push(array[i].match(/(?<=x: )(.*?)(?=,)/g)[0]);
        }
        if (array[i].includes('rs:2555')) {
          // console.log(this.parseBlockDetails(blockDetails + array[i].slice(array[i].indexOf('M')) + '}'));
          obj.blockDetails = this.parseBlockDetails(blockDetails + array[i].slice(array[i].indexOf('M')) + '}');
        }
      }
      // fs.writeFile(join(process.cwd(), 'src', 'api', 'stacks', 'hello.txt'), stderr + stdout, (err) => {
      //   if (err) throw err;
      //   console.log('The file has been saved!');
      // });
      return obj;
    } catch (error) {
      console.log('error-->', error);
      return obj;
    }
    /*
    const output = execFile('/Users/walterdevault/Stacks/stacks-blockchain/target/release/stacks-inspect', ['try-mine', '/Users/walterdevault/Stacks/stacks-blockchain/testnet/stacks-node/mainnet/', '10', '30000'], { encoding: 'utf-8'}, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return;
      }
      console.log(`stdout: ${stdout}`);
      fs.writeFile(join(process.cwd(), 'src', 'api', 'stacks', 'hello.txt'), stderr + stdout, (err) => {
        if (err) throw err;
        console.log('The file has been saved!');
      });
      const array = stderr.split('\n');
      // const obj = {};
      // const values = x.match(/\: (.*?)\,/g)
      // obj.tx_id = values[0].slice(2, -1);
      // obj.tx_type = values[1].slice(2, -1);
      // console.log(obj)
      // console.log(x.match(/\: (.*?)\,/g))
      array.push(stdout);
      let blockDetails = '{';
      for (let i = 0; i < array.length; i++) {
        if(array[i].includes('rs:1614')) {
          // @ts-ignore
          // txArray.push(array[i].match(/(?<=x: )(.*?)(?=,)/g)[0]);
          obj.tx_ids.push(array[i].match(/(?<=x: )(.*?)(?=,)/g)[0]);

        }
        if (array[i].includes('rs:2555')) {
          // console.log(this.parseBlockDetails(blockDetails + array[i].slice(array[i].indexOf('M')) + '}'));
          obj.blockDetails = this.parseBlockDetails(blockDetails + array[i].slice(array[i].indexOf('M')) + '}');
        }
      }
      // obj.tx_ids = txArray;
      // console.log('Tx Array--->', txArray);
      // console.log('Block Deatails-->', blockDetails);
      console.error(`stderr: ${stderr}`);
    });
    // console.log('Returned object -->', obj);
    return obj;
    */
  }
  normalizeJson(str: string): string{
    return str.replace(/[\s\n\r\t]/gs, '').replace(/,([}\]])/gs, '$1')
    .replace(/([,{[]|)(?:("|'|)([\w_\- ]+)\2:|)("|'|)(.*?)\4([,}\]])/gs, (str, start, q1, index, q2, item, end) => {
        item = item.replace(/"/gsi, '').trim();
        if(index){index = '"'+index.replace(/"/gsi, '').trim()+'"';}
        if(!item.match(/^[0-9]+(\.[0-9]+|)$/) && !['true','false'].includes(item)){item = '"'+item+'"';}
        if(index){return start+index+':'+item+end;}
        return start+item+end;
    });
}
  parseBlockDetails(details: string) {
    const removeQuotes = details.replace(/"([^"]+(?="))"/g, '$1');
    const addDoubleQuotes = this.normalizeJson(removeQuotes);
    // const jsonReady = addDoubleQuotes.replace('"{runtime', '{"runtime"').replace('","w',',"w').replace('"%-full:', '"%-full":').replace('","a',',"a').replace('ck":', 'ck":"').replace(',"parent_stacks_microblock_seq', '","parent_stacks_microblock_seq');
    // const jsonReady = addDoubleQuotes.replace('"{runtime', '{"runtime"').replace('","w',',"w').replace('"%-full:', '"%-full":').replace('","a',',"a');
    const jsonReady = addDoubleQuotes.replace('"{runtime', '{"runtime"').replace('","w',',"w');


    console.log('json ready -->', jsonReady);
    return JSON.parse(jsonReady);
  }
}

export default new StacksMempoolBlocks();