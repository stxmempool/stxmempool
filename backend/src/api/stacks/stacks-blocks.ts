import config from '../../config';
import stacksApi from './stacks-api';
import loadingIndicators from '../loading-indicators';
import transactionUtils from '../transaction-utils';
import { VbytesPerSecond } from '../../mempool.interfaces';
import { Block, MempoolTransactionListResponse, Transaction, MempoolTransaction } from '@stacks/stacks-blockchain-api-types';
import { BlockExtension, ExtendedStacksBlock, StacksTransactionDataWithSize } from './stacks-api.interface';


import { Common } from '../common';
import logger from '../../logger';
import axios from 'axios';

class StacksBlocks {
  public blocks: any;
  public initialBlocks: Block[] = [];
  public extendedBlocks: ExtendedStacksBlock[] = [];
  // public extendedBlocks: any = [];
  public stacksBlockTip: number = 0;
  private counter: number = 1;

  constructor() {}

  /*  NON ASYNC FUNCTIONS   */
  public getBlocks() {
    return this.blocks;
  }
  // need to define ExtendedBlocks
  public getExtendedBlocks(): ExtendedStacksBlock[] {
    return this.extendedBlocks;
  }

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
    };
  }

  /*  ASYNC FUNCTIONS   */
  public async $setInitialBlocks(): Promise<void> {
    const response = await axios.get('https://stacks-node-api.mainnet.stacks.co/extended/v1/block?limit=8');
    // const response = await axios.get('http://localhost:3999/extended/v1/block?limit=8');

    this.initialBlocks = response.data.results;
  }

  public async $processNewBlock() {
    const observedBlock = this.initialBlocks[0];
    const transactions = observedBlock.txs;
    const blockExtended: ExtendedStacksBlock = Object.assign({ 
      id: observedBlock.hash,
      tx_count: observedBlock.txs.length,
      timestamp: observedBlock.burn_block_time,
      previousblockhash: observedBlock.parent_block_hash
    }, observedBlock);
    try {
      const finishedBlock = await this.$getBlockExtended(blockExtended, transactions);
      // if (blockExtended) {
      //   blockExtended.tx_count = observedBlock.txs.length;
      //   blockExtended.id = blockExtended.hash;
      //   blockExtended.timestamp = observedBlock.burn_block_time;
      //   blockExtended.previousblockhash = observedBlock.parent_block_hash;
      // }
      // console.log(blockExtended);
      // return blockExtended;
      if (finishedBlock) this.extendedBlocks.unshift(finishedBlock);

    } catch (error) {
      console.log('ERROR in $processBlock', error);
    }
  }
  public async $processBlock() {
    if (this.counter > 8) return;
    const observedBlock = this.initialBlocks[this.initialBlocks.length - this.counter];
    const transactions = observedBlock.txs;
    const blockExtended: ExtendedStacksBlock = Object.assign({ 
      id: observedBlock.hash,
      tx_count: observedBlock.txs.length,
      timestamp: observedBlock.burn_block_time,
      previousblockhash: observedBlock.parent_block_hash
    }, observedBlock);
    try {
      const finishedBlock = await this.$getBlockExtended(blockExtended, transactions);
      // if (blockExtended) {
      //   blockExtended.tx_count = observedBlock.txs.length;
      //   blockExtended.id = blockExtended.hash;
      //   blockExtended.timestamp = observedBlock.burn_block_time;
      //   blockExtended.previousblockhash = observedBlock.parent_block_hash;
      // }
      // console.log(blockExtended);
      // return blockExtended;
      if (finishedBlock) this.extendedBlocks.unshift(finishedBlock);
    } catch (error) {
      console.log('ERROR in $processBlock', error);
    }
    this.counter++;
  }
  public async $checkForNewBlock(): Promise<void> {
    this.stacksBlockTip = await stacksApi.$getBlockTip();
    if (this.stacksBlockTip > this.extendedBlocks[0].height && this.counter !== 8) {
      console.log('processing blocks');
      console.log(`current block tip --> ${this.stacksBlockTip}, current stored extended block height--> ${this.extendedBlocks[0].height}, and current counter ${this.counter}`)
      await this.$processBlock();
    } else if (this.stacksBlockTip > this.extendedBlocks[0].height && this.counter === 8) {
      console.log('new block detected');
      console.log(`current block tip --> ${this.stacksBlockTip}, current stored extended block height--> ${this.extendedBlocks[0].height}, and current counter ${this.counter}`)
      const newestBlock = await stacksApi.$getNewestBlock();
      this.initialBlocks.unshift(newestBlock);
      this.counter--;
      await this.$processBlock();
    } else if (this.stacksBlockTip === this.extendedBlocks[0].height) {
      console.log('no new blocks');
      return;
    }
  }

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