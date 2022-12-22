import config from '../../config';
import stacksApi from './stacks-api';
import bitcoinApi from '../bitcoin/bitcoin-api-factory';
import bitcoinClient from '../bitcoin/bitcoin-client';
import BitcoinApi from '../bitcoin/bitcoin-api';
import loadingIndicators from '../loading-indicators';
import transactionUtils from '../transaction-utils';
import { VbytesPerSecond } from '../../mempool.interfaces';
import { Block, MempoolTransactionListResponse, Transaction, MempoolTransaction } from '@stacks/stacks-blockchain-api-types';
import { BlockExtension, ExtendedStacksBlock, ExtendedStacksTransaction, StacksBlockSummary, StacksTransactionDataWithSize } from './stacks-api.interface';


import { Common } from '../common';
import logger from '../../logger';
import axios from 'axios';
import stacksMempool from './stacks-mempool';

class StacksBlocks {
  private blocks: ExtendedStacksBlock[] = [];
  private blockSummaries: StacksBlockSummary[] = [];
  private currentBlockHeight = 0;
  private currentDifficulty = 0;
  private currentBTCHeight = 0;
  private lastDifficultyAdjustmentTime = 0;
  private previousDifficultyRetarget = 0;
  public initialBlocks: Block[] = [];
  public extendedBlocks: ExtendedStacksBlock[] = [];
  // public extendedBlocks: any = [];
  public stacksBlockTip: number = 0;
  private counter: number = 1;
  private genesisDate: Date = new Date('2021-01-14T17:28:24.000Z');

  private newBlockCallbacks: ((block: ExtendedStacksBlock, txIds: string[], transactions: ExtendedStacksTransaction[]) => void)[] = [];
  private newAsyncBlockCallbacks: ((block: ExtendedStacksBlock, txIds: string[], transactions: ExtendedStacksTransaction[]) => Promise<void>)[] = [];
  constructor() {}

  /*  NON ASYNC FUNCTIONS   */
  public getBlocks(): ExtendedStacksBlock[] {
    return this.blocks;
  }
  public getLastDifficultyAdjustmentTime(): number {
    return this.lastDifficultyAdjustmentTime;
  }

  public getPreviousDifficultyRetarget(): number {
    return this.previousDifficultyRetarget;
  }
  public getCurrentBTCHeight(): number {
    return this.currentBTCHeight;
  }
  public setBlocks(blocks: ExtendedStacksBlock[]) {
    this.blocks = blocks;
  }
  
  public getExtendedBlocks(): ExtendedStacksBlock[] {
    return this.extendedBlocks;
  }
  public getBlockSummaries(): StacksBlockSummary[] {
    return this,this.blockSummaries;
  }
  public setBlockSummaries(blockSummaries: StacksBlockSummary[]) {
    this.blockSummaries = blockSummaries;
  }
  public setNewBlockCallback(fn: (block: ExtendedStacksBlock, txIds: string[], transactions: ExtendedStacksTransaction[]) => void) {
    this.newBlockCallbacks.push(fn);
  }

  public setNewAsyncBlockCallback(fn: (block: ExtendedStacksBlock, txIds: string[], transactions: ExtendedStacksTransaction[]) => Promise<void>) {
    this.newAsyncBlockCallbacks.push(fn);
  }

  private getReward(): number {
    const now = new Date(Date.now());
    const genesisDate = new Date('2021-01-14T17:28:24.000Z');
    const rewardPeriod = new Date(genesisDate.getTime());
    if (now.getTime() < rewardPeriod.setFullYear(genesisDate.getFullYear() + 4)) {
      return 1000;
    } else if (now.getTime() > rewardPeriod.getTime() && now.getTime() < rewardPeriod.setFullYear(genesisDate.getFullYear() + 8)) {
      return 500;
    } else if (now.getTime() > rewardPeriod.setFullYear(genesisDate.getFullYear() + 8) && now.getTime() < rewardPeriod.setFullYear(genesisDate.getFullYear() + 12)) {
      return 250;
    } else {
      return 125;
    }
  }

  /**
   * Return the list of transaction for a block
   * @param blockHash
   * @param blockHeight
   * @param onlyCoinbase - Set to true if you only need the coinbase transaction
   * @returns Promise<ExtendedStacksTransaction[]>
   */
   private async $getTransactionsExtended(
    // blockHash: string,
    // blockHeight: number,
    block: Block,
    onlyCoinbase: boolean,
    quiet: boolean = false,
  ): Promise<ExtendedStacksTransaction[]> {
    const transactions: ExtendedStacksTransaction[] = [];
    // const txIds: string[] = await stacksApi.$getTxIdsForBlock(block.hash);
    const txIds = block.txs;
    const txsVerbose = await stacksApi.$getVerboseTransactions(txIds);

    const mempool = stacksMempool.getMempool();
    let transactionsFound = 0;
    let transactionsFetched = 0;

    for (let i = 0; i < txIds.length; i++) {
      // if (mempool[txIds[i]]) {
      if (mempool[txsVerbose[txIds[i]].result.tx_id]) {

        // We update blocks before the mempool (index.ts), therefore we can
        // optimize here by directly fetching txs in the "outdated" mempool
        transactions.push(mempool[txIds[i]]);
        transactionsFound++;
      } else if (config.MEMPOOL.BACKEND === 'esplora' || !stacksMempool.hasPriority() || i === 0) {
        // Otherwise we fetch the tx data through backend services (esplora, electrum, core rpc...)
        if (!quiet && (i % (Math.round((txIds.length) / 10)) === 0 || i + 1 === txIds.length)) { // Avoid log spam
          logger.debug(`Indexing tx ${i + 1} of ${txIds.length} in block #${block.height}`);
        }
        try {
          // const tx = await transactionUtils.$getStacksTransactionExtended(txIds[i]);
          const tx = await transactionUtils.$getStacksTransactionExtended(txsVerbose[txIds[i]].result.tx_id, txsVerbose[txIds[i]].result);

          transactions.push(tx);
          transactionsFetched++;
        } catch (e) {
          if (i === 0) {
            const msg = `Cannot fetch coinbase tx ${txIds[i]}. Reason: ` + (e instanceof Error ? e.message : e); 
            logger.err(msg);
            throw new Error(msg);
          } else {
            logger.err(`Cannot fetch tx ${txIds[i]}. Reason: ` + (e instanceof Error ? e.message : e));
          }
        }
      }
      // TODO WRITE CUSTOM FUNCTION TO RETIREVE COINBASE TRANSACTION
      if (onlyCoinbase === true) {
        break; // Fetch the first transaction and exit
      }
    }
      // transactions.forEach((tx) => {
      //   if (!tx.cpfpChecked) {
      //     Common.setRelativesAndGetCpfpInfo(tx, mempool); // Child Pay For Parent
      //   }
      // });
      if (!quiet) {
        logger.debug(`${transactionsFound} of ${txIds.length} found in mempool. ${transactionsFetched} fetched through backend service.`);
      }
    
      return transactions;
  }

  /**
   * Return a block summary (list of stripped transactions)
   * @param block
   * @returns StacksBlockSummary
   */
  //  private summarizeBlock(block: Block): StacksBlockSummary {
  //   const stripped = block.txs.map((tx) => {
  //     return {
  //       txid: tx.txid,
  //       vsize: tx.weight / 4,
  //       fee: tx.fee ? Math.round(tx.fee * 100000000) : 0,
  //       value: Math.round(tx.vout.reduce((acc, vout) => acc + (vout.value ? vout.value : 0), 0) * 100000000)
  //     };
  //   });

  //   return {
  //     id: block.hash,
  //     transactions: stripped
  //   };
  // }

  /**
   * Return a block with additional data (reward, coinbase, fees...)
   * @param block
   * @param transactions
   * @returns BlockExtended
   */

  public calcCost(block: Block): number {
    // const totalRuntimeCost = transactionsData.map(data => data.execution_cost_runtime).reduce((a, b) => a + b);
    // const totalReadCountCost = transactionsData.map(data => data.execution_cost_read_count).reduce((a, b) => a + b);
    // const totalReadLengthCost = transactionsData.map(data => data.execution_cost_read_length).reduce((a, b) => a + b);
    // const totalWriteCountCost = transactionsData.map(data => data.execution_cost_write_count).reduce((a, b) => a + b);
    // const totalWriteLengthCost = transactionsData.map(data => data.execution_cost_write_length).reduce((a, b) => a + b);
    
    const percentageUsedOfRuntime = block.execution_cost_runtime / 5000000000;
    const percentageUsedOfReadCount = block.execution_cost_read_count / 15000;
    const percentageUsedOfReadLength = block.execution_cost_read_length / 100000000;
    const percentageUsedOfWriteCount = block.execution_cost_write_count / 15000;
    const percentageUsedOfWriteLength = block.execution_cost_write_length / 15000000;
    // console.log('runtime total cost-->', totalRuntimeCost);
    // console.log('readCount total cost-->', readCountCostArray);
    // console.log('writeCount total cost-->', writeCountCostArray);
    // console.log('runtime total cost-->', runtimeCostArray);
    console.log('percentageUsedOfRuntime-->', percentageUsedOfRuntime);
    console.log('percentageUsedOfReadCount-->', percentageUsedOfReadCount);
    console.log('percentageUsedOfReadLength-->', percentageUsedOfReadLength);
    console.log('percentageUsedOfWriteCount-->', percentageUsedOfWriteCount);
    console.log('percentageUsedOfWriteLength-->', percentageUsedOfWriteLength);
    const percentageUsed = (percentageUsedOfRuntime + percentageUsedOfReadCount + percentageUsedOfReadLength + percentageUsedOfWriteCount + percentageUsedOfWriteLength) / 5;
    console.log('average precentage used of Block-->', percentageUsed * 100);
    return percentageUsed * 100;
  }
  public calcFeeRange(transactionExtras: any[]): BlockExtension {
    const feeArray = transactionExtras.map(extra => extra.fee_rate);
    const filteredArray = feeArray.filter(fee => fee !== 0);
    const averageFee = filteredArray.reduce((a: number, b: number): number => a + b) / filteredArray.length;
    const totalFees = filteredArray.reduce((a, b) => a + b);
    //iterate through the filteredArray
      //divide the current fee by the totalFees
      //push the result to an array
    // find the average fee
    //Total Fees / Total Cost of Block
    const feePercentages = filteredArray.map(fee => fee / totalFees);
    const avgFeeRate = feePercentages.reduce((a, b) => a + b) / 2;

    let feeMedian: number = 0;

    filteredArray.sort((a, b) => a - b);
    if (filteredArray.length > 1){
      const midpoint = Math.floor(filteredArray.length / 2);
      const median = filteredArray.length % 2 === 1 ?
        filteredArray[midpoint] :
        (filteredArray[midpoint - 1] + filteredArray[midpoint]) / 2;
      feeMedian = median;
    }
    const sortedArray = [...new Set(filteredArray)];
    let lowestFee: number;
    if(sortedArray[0] === 0) {
      lowestFee = sortedArray[1];
    }
    else {
      lowestFee = sortedArray[0];
    }
    const highestFee = sortedArray[sortedArray.length - 1];
    const range = highestFee - lowestFee;
    return {
      avgFee: averageFee,
      feeRange: sortedArray,
      totalFees: totalFees,
      medianFee: feeMedian,
      avgFeeRate: avgFeeRate * 100,
      reward: 1000,
    };
  }

  /*  ASYNC FUNCTIONS   */

  public async $updateBlocks() {
    let fastForwarded = false;
    const blockHeightTip = await stacksApi.$getBlockHeightTip();
    this.currentBTCHeight = await bitcoinApi.$getBlockHeightTip();
    if (this.blocks.length === 0) {
      console.log('this.blocks length is zero');
      // this.currentBlockHeight = Math.max(blockHeightTip - config.STACKS.INITIAL_BLOCKS_AMOUNT, -1);
      this.currentBlockHeight = Math.max(blockHeightTip - 2, -1);

    } else {
      this.currentBlockHeight = this.blocks[this.blocks.length - 1].height;
    }
    // indexing is disabled here because we do not have a Stacks DB at this time

    if (blockHeightTip - this.currentBlockHeight > config.STACKS.INITIAL_BLOCKS_AMOUNT * 2) {
      logger.info(`${blockHeightTip - this.currentBlockHeight} blocks since tip. Fast forwarding to the ${config.MEMPOOL.INITIAL_BLOCKS_AMOUNT} recent blocks`);
      this.currentBlockHeight = blockHeightTip - config.STACKS.INITIAL_BLOCKS_AMOUNT;
      fastForwarded = true;
      logger.info(`Re-indexing skipped blocks and corresponding hashrates data`);
      // indexer.reindex(); // Make sure to index the skipped blocks #1619
    }

    // At this time DifficultyAdjustment is not relevent

    if (!this.lastDifficultyAdjustmentTime) {
      const blockchainInfo = await bitcoinClient.getBlockchainInfo();
      const bTCBlockHeightTip = await bitcoinApi.$getBlockHeightTip();

      if (blockchainInfo.blocks === blockchainInfo.headers) {
        const heightDiff = bTCBlockHeightTip % 2016;
        const bTCBlockHash = await bitcoinApi.$getBlockHash(bTCBlockHeightTip - heightDiff);
        const bTCBlock = BitcoinApi.convertBlock(await bitcoinClient.getBlock(bTCBlockHash));
        this.lastDifficultyAdjustmentTime = bTCBlock.timestamp;
        this.currentDifficulty = bTCBlock.difficulty;

        if (bTCBlockHeightTip >= 2016) {
          const previousPeriodBlockHash = await bitcoinApi.$getBlockHash(bTCBlockHeightTip - heightDiff - 2016);
          const previousPeriodBlock = await bitcoinClient.getBlock(previousPeriodBlockHash);
          this.previousDifficultyRetarget = (bTCBlock.difficulty - previousPeriodBlock.difficulty) / previousPeriodBlock.difficulty * 100;
          logger.debug(`Initial difficulty adjustment data set.`);
        }
      } else {
        logger.debug(`Blockchain headers (${blockchainInfo.headers}) and blocks (${blockchainInfo.blocks}) not in sync. Waiting...`);
      }
    }
    while (this.currentBlockHeight < blockHeightTip) {
      if (this.currentBlockHeight < blockHeightTip - config.STACKS.INITIAL_BLOCKS_AMOUNT) {
        this.currentBlockHeight = blockHeightTip;
      } else {
        this.currentBlockHeight++;
        logger.debug(`New block found (#${this.currentBlockHeight})!`);
      }
      // const blockHash = await bitcoinApi.$getBlockHash(this.currentBlockHeight);
      // const blockHash = await stacksApi.$getBlockHashByHeight(this.currentBlockHeight);
      // skipping verboseBlock and Summaries, as they relate to diskCache, which we are currently skipping
      // const verboseBlock = await bitcoinClient.getBlock(blockHash, 2);
      // const block = BitcoinApi.convertBlock(verboseBlock);
      // const txIds: string[] = await bitcoinApi.$getTxIdsForBlock(blockHash);
      const block = await stacksApi.$getBlockByHeight(this.currentBlockHeight);
      const blockHash = block.hash;
      const txIds = block.txs;
      
      const transactions = await this.$getTransactionsExtended(block, false);
      const blockExtended: ExtendedStacksBlock = await this.$getBlockExtendedTest(block, transactions);

      const blockSummary: StacksBlockSummary = this.summarizeBlock(block, transactions);
      // start async callbacks
      const callbackPromises = this.newAsyncBlockCallbacks.map((cb) => cb(blockExtended, txIds, transactions));

      this.blocks.push(blockExtended);
      if (this.blocks.length > config.MEMPOOL.INITIAL_BLOCKS_AMOUNT * 4) {
        this.blocks = this.blocks.slice(-config.MEMPOOL.INITIAL_BLOCKS_AMOUNT * 4);
      }
      this.blockSummaries.push(blockSummary);
      if (this.blockSummaries.length > config.MEMPOOL.INITIAL_BLOCKS_AMOUNT * 4) {
        this.blockSummaries = this.blockSummaries.slice(-config.MEMPOOL.INITIAL_BLOCKS_AMOUNT * 4);
      }
      if (this.newBlockCallbacks.length) {
        this.newBlockCallbacks.forEach((cb) => cb(blockExtended, txIds, transactions));
      }
      // wait for pending async callbacks to finish
      await Promise.all(callbackPromises);
    }
  }
  /**
   * Return a block summary (list of stripped transactions)
   * @param block
   * @returns StacksBlockSummary
   */
  private summarizeBlock(block: Block, transactions: ExtendedStacksTransaction[]): StacksBlockSummary {
    const stripped = transactions.map(tx => {
      return {
        txid: tx.tx_id,
        vsize: tx.vsize,
        fee: tx.feeRateAsNumber,
        type: tx.tx_type,
      };
    });
    return {
      id: block.hash,
      transactions: stripped,
    };
  }
  private async $getBlockExtendedTest (block: Block, transactions: ExtendedStacksTransaction[]): Promise<ExtendedStacksBlock> { //Promise<ExtendedStacksBlock> {
    const blockExtended: ExtendedStacksBlock = Object.assign({
      tx_count: block.txs.length,
      id: block.hash,
      timestamp: block.burn_block_time,
      previousblockhash: block.parent_block_hash,
      extras: {
        reward: this.getReward()
      }
    }, block);
    // blockExtended.extras.coinbaseTx = transactionUtils.stripCoinbaseTransaction(transactions[0]);
    // blockExtended.extras.coinbaseRaw = blockExtended.extras.coinbaseTx.vin[0].scriptsig;
    blockExtended.extras.usd = await stacksApi.$getStacksPrice();
    blockExtended.size = transactions.map(tx => tx.vsize).reduce((acc, curr) => acc + curr);
    if (block.height === 0) {
      blockExtended.extras.medianFee = 0; // 50th percentiles
      blockExtended.extras.feeRange = [0, 0, 0, 0, 0, 0, 0];
      blockExtended.extras.totalFees = 0;
      blockExtended.extras.avgFee = 0;
      blockExtended.extras.avgFeeRate = 0;
    } else {

      // const feeArray = await this.$processRosettaBlock(blockExtended.height, blockExtended.hash);
      // const stats = await bitcoinClient.getBlockStats(block.id, [
      //   'feerate_percentiles', 'minfeerate', 'maxfeerate', 'totalfee', 'avgfee', 'avgfeerate'
      // ]);
      // remove the 0 fee of a coinbase transacation
      const feeArray = transactions.map(tx => tx.feeRateAsNumber);
      const filteredArray = feeArray.filter(fee => fee !== 0);

      filteredArray.sort((a, b) => a - b);
      blockExtended.extras.medianFee = Common.percentile(filteredArray, config.MEMPOOL.RECOMMENDED_FEE_PERCENTILE);
      blockExtended.extras.feeRange = filteredArray;
      blockExtended.extras.totalFees = feeArray.reduce((acc, curr) => acc + curr);
      blockExtended.extras.avgFee = blockExtended.extras.totalFees / filteredArray.length;
      blockExtended.extras.avgFeeRate = transactions.map(tx => tx.feePerVsize).reduce((acc, curr) => acc + curr) / filteredArray.length;

    }
    return blockExtended;
  }

  public async $processRosettaBlock(blockHeight: number, blockHash: string): Promise<number[]> {
    const rosettaBlock = await stacksApi.$getRosettaBlock(blockHeight, blockHash);
    const allBlockFees = rosettaBlock.transactions.map(transaction => {
      if (transaction.operations[0].type === 'fee') {
        return Math.abs(Number(transaction.operations[0].amount?.value));
      } else {
        return 0;
      }
    });
    return allBlockFees;
  }
  public async $setInitialBlocks(): Promise<void> {
    const response = await axios.get('https://stacks-node-api.mainnet.stacks.co/extended/v1/block?limit=8');
    // const response = await axios.get('http://localhost:3999/extended/v1/block?limit=8');

    this.initialBlocks = response.data.results;
  }

  // public async $processNewBlock() {
  //   const observedBlock = this.initialBlocks[0];
  //   const transactions = observedBlock.txs;
  //   const blockExtended: ExtendedStacksBlock = Object.assign({ 
  //     id: observedBlock.hash,
  //     tx_count: observedBlock.txs.length,
  //     timestamp: observedBlock.burn_block_time,
  //     previousblockhash: observedBlock.parent_block_hash
  //   }, observedBlock);
  //   try {
  //     const finishedBlock = await this.$getBlockExtended(blockExtended, transactions);
  //     // if (blockExtended) {
  //     //   blockExtended.tx_count = observedBlock.txs.length;
  //     //   blockExtended.id = blockExtended.hash;
  //     //   blockExtended.timestamp = observedBlock.burn_block_time;
  //     //   blockExtended.previousblockhash = observedBlock.parent_block_hash;
  //     // }
  //     // console.log(blockExtended);
  //     // return blockExtended;
  //     if (finishedBlock) this.extendedBlocks.unshift(finishedBlock);

  //   } catch (error) {
  //     console.log('ERROR in $processBlock', error);
  //   }
  // }
  // public async $processBlock() {
  //   if (this.counter > 8) return;
  //   const observedBlock = this.initialBlocks[this.initialBlocks.length - this.counter];
  //   const transactions = observedBlock.txs;
  //   const blockExtended: ExtendedStacksBlock = Object.assign({ 
  //     id: observedBlock.hash,
  //     tx_count: observedBlock.txs.length,
  //     timestamp: observedBlock.burn_block_time,
  //     previousblockhash: observedBlock.parent_block_hash
  //   }, observedBlock);
  //   try {
  //     const finishedBlock = await this.$getBlockExtended(blockExtended, transactions);
  //     // if (blockExtended) {
  //     //   blockExtended.tx_count = observedBlock.txs.length;
  //     //   blockExtended.id = blockExtended.hash;
  //     //   blockExtended.timestamp = observedBlock.burn_block_time;
  //     //   blockExtended.previousblockhash = observedBlock.parent_block_hash;
  //     // }
  //     // console.log(blockExtended);
  //     // return blockExtended;
  //     if (finishedBlock) this.extendedBlocks.unshift(finishedBlock);
  //   } catch (error) {
  //     console.log('ERROR in $processBlock', error);
  //   }
  //   this.counter++;
  // }
  // public async $checkForNewBlock(): Promise<void> {
  //   this.stacksBlockTip = await stacksApi.$getBlockHeightTip();
  //   if (this.stacksBlockTip > this.extendedBlocks[0].height && this.counter !== 8) {
  //     console.log('processing blocks');
  //     console.log(`current block tip --> ${this.stacksBlockTip}, current stored extended block height--> ${this.extendedBlocks[0].height}, and current counter ${this.counter}`)
  //     await this.$processBlock();
  //   } else if (this.stacksBlockTip > this.extendedBlocks[0].height && this.counter === 8) {
  //     console.log('new block detected');
  //     console.log(`current block tip --> ${this.stacksBlockTip}, current stored extended block height--> ${this.extendedBlocks[0].height}, and current counter ${this.counter}`)
  //     const newestBlock = await stacksApi.$getNewestBlock();
  //     this.initialBlocks.unshift(newestBlock);
  //     this.counter--;
  //     await this.$processBlock();
  //   } else if (this.stacksBlockTip === this.extendedBlocks[0].height) {
  //     console.log('no new blocks');
  //     return;
  //   }
  // }

  public async $getBlockExtended(block: ExtendedStacksBlock, transactions: string[]): Promise<ExtendedStacksBlock | undefined> {
    try {
      const blockExtended: ExtendedStacksBlock = Object.assign({ extras: {} }, block);
      const transactionsData = await this.$iterateThroughTransactions(transactions);
      if (transactionsData) {
        // console.log(transactionsData);
        // const totalRuntime = allFees.reduce((a, b) => a + b);
        // const percentageofTotalRuntime = totalRuntime / 5000000000;
        // console.log('totalRuntime-->', allFees);
        // console.log(transactionsData);
        // blockExtended.totalRuntime = this.calcCost(transactionsData);
        const sizes = transactionsData.map(data => data.size);
        blockExtended.extras = this.calcFeeRange(transactionsData);
        blockExtended.size = sizes.reduce((acc, curr) => acc + curr);
        blockExtended.extras.usd = await stacksApi.$getStacksPrice();
      }
      return blockExtended;
    } catch (error) {
      console.log('error in $getBlockExtended-->', error);
    }
  }

  public async $iterateThroughTransactions(transactionArray: string[]) {
    try {
      const result = Promise.all(transactionArray.map( async transaction => {
        // const value = await this.$getTransactionFee(transaction);
        // const value = await this.$getTransactionRuntimeCost(transaction);
        const size = await stacksApi.$getTransactionSize(transaction);
        const data = await stacksApi.$getTransactionData(transaction);
        
          return {
            fee_rate: data.fee_rate,
            execution_cost_read_count: data.execution_cost_read_count,
            execution_cost_read_length: data.execution_cost_read_length,
            execution_cost_runtime: data.execution_cost_runtime, 
            execution_cost_write_count: data.execution_cost_write_count,
            execution_cost_write_length: data.execution_cost_write_length,
            size,
          };
        

        // return fee_rate;
        // return {
        //   size,
        //   fee_rate
        // };
    }));
      return result;
    } catch (error) {
      console.log('Error in iterateThroughTransactions', error);
    }
  }



  // not being used
  // public async $whatever() {
  //   try {
  //     const blocks = await this.$getBlocks();
  //     const results = Promise.all(blocks.map( async block => {
  //       const transactions = block.txs;
  //       const blockExtended = await this.$getBlockExtended(block, transactions);
  //       blockExtended.tx_count = block.txs.length;
  //       blockExtended.id = blockExtended.hash;
  //       blockExtended.timestamp = block.burn_block_time;
  //       blockExtended.previousblockhash = block.parent_block_hash;
  //       //this only works for one block
  //       // blockExtended.percentagedUsed = this.calcCost(blocks[0]);
  //       console.log(blockExtended);
  //       return blockExtended;
  //     }));
  //     return results;
  //   } catch (error) {
  //     console.log(error);
  //   }
  // }
  // not being used
  public async $getBlocks() {
    const response = await axios.get('https://stacks-node-api.mainnet.stacks.co/extended/v1/block?limit=1');
    // const response = await axios.get('http://localhost:3999/extended/v1/block?limit=1');

    // const response = await axios.get('https://stacks-node-api.mainnet.stacks.co/extended/v1/block?limit=10');
    this.initialBlocks = response.data.results;
    this.extendedBlocks = response.data.results;
    return this.initialBlocks;
  }
  
}

export default new StacksBlocks();