import axios from 'axios';
import { Application, Request, Response } from 'express';
import { Block, MempoolTransactionListResponse, Transaction, MempoolTransaction } from '@stacks/stacks-blockchain-api-types';
import { ExtendedStacksBlock } from './stacks-api.interface';

import config from '../../config';


class StacksRoutes {

  // not being used currently but will be expanded with further routes
  public initRoutes(app: Application) {
    app.get(config.MEMPOOL.API_URL_PREFIX + 'assets/icons', this.$getBlocks);
  }
  // place holder api call for routes
  public async $getBlocks() {
    const response = await axios.get('https://stacks-node-api.mainnet.stacks.co/extended/v1/block?limit=1');
    // const response = await axios.get('https://stacks-node-api.mainnet.stacks.co/extended/v1/block?limit=10');
    return response.data.results;;
  }

  // public async $setInitialBlocks() {
  //   const response = await axios.get('https://stacks-node-api.mainnet.stacks.co/extended/v1/block?limit=8');
  //   this.initialBlocks = response.data.results;
  // }
  // public async $processNewBlock() {
  //   const observedBlock = this.initialBlocks[0];
  //   const transactions = observedBlock.txs;
  //   try {
  //     const blockExtended = await this.$getBlockExtended(observedBlock, transactions);
  //     blockExtended.tx_count = observedBlock.txs.length;
  //     blockExtended.id = blockExtended.hash;
  //     blockExtended.timestamp = observedBlock.burn_block_time;
  //     blockExtended.previousblockhash = observedBlock.parent_block_hash;
  //     // console.log(blockExtended);
  //     // return blockExtended;
  //     this.extendedBlocks.unshift(blockExtended);
  //   } catch (error) {
  //     console.log('ERROR in $processBlock', error);
  //   }
  // }

  // public async $processBlock() {
  //   if (this.counter > 8) return;
  //   const observedBlock = this.initialBlocks[this.initialBlocks.length - this.counter];
  //   const transactions = observedBlock.txs;
  //   try {
  //     const blockExtended = await this.$getBlockExtended(observedBlock, transactions);
  //     blockExtended.tx_count = observedBlock.txs.length;
  //     blockExtended.id = blockExtended.hash;
  //     blockExtended.timestamp = observedBlock.burn_block_time;
  //     blockExtended.previousblockhash = observedBlock.parent_block_hash;
  //     // console.log(blockExtended);
  //     // return blockExtended;
  //     this.extendedBlocks.unshift(blockExtended);
  //   } catch (error) {
  //     console.log('ERROR in $processBlock', error);
  //   }
  //   this.counter++;
  // }

  /*
  fetch one block
    const block = await $getBlocks()
  grab all transactions from the block
    const transactions = block[0].txs;
  pass the transactions into an extension function
    const transactionsExtended = await this.$getTransactionsExtended(transactions);
  pass the transactions into a blockextended function
    const blockExtended = await this.$getBlockExtended(block, transactions);
    
  */

  // public async overall() {
  //   try {
  //     const blocks = await this.$getBlocks();
  //     const results = Promise.all(blocks.map( async block => {
  //       const transactions = block.txs;
  //       const blockExtended = await this.$getBlockExtended(block, transactions);
  //       blockExtended.tx_count = block.txs.length;
  //       blockExtended.id = blockExtended.hash;
  //       blockExtended.timestamp = block.burn_block_time;
  //       blockExtended.previousblockhash = block.parent_block_hash;
  //       // console.log(blockExtended);
  //       return blockExtended;
  //     }));
  //     return results;
  //   } catch (error) {
  //     console.log('ERROR-->', error);
  //   }

  // }
  // try {
  //   // const result = Promise.all(block[0].txs.map( async transaction => {
  //   const result = Promise.all(transactionArray.map( async transaction => {
  //     const value = await this.$getTransactionFee(transaction);
  //     return value;
  // }));
  //   return result;
  // } catch (error) {
  //   console.log(error);
  // }
  // public calcCost(block: Block) {
  //   // const totalRuntimeCost = transactionsData.map(data => data.execution_cost_runtime).reduce((a, b) => a + b);
  //   // const totalReadCountCost = transactionsData.map(data => data.execution_cost_read_count).reduce((a, b) => a + b);
  //   // const totalReadLengthCost = transactionsData.map(data => data.execution_cost_read_length).reduce((a, b) => a + b);
  //   // const totalWriteCountCost = transactionsData.map(data => data.execution_cost_write_count).reduce((a, b) => a + b);
  //   // const totalWriteLengthCost = transactionsData.map(data => data.execution_cost_write_length).reduce((a, b) => a + b);
    
  //   const percentageUsedOfRuntime = block.execution_cost_runtime / 5000000000;
  //   const percentageUsedOfReadCount = block.execution_cost_read_count / 15000;
  //   const percentageUsedOfReadLength = block.execution_cost_read_length / 100000000;
  //   const percentageUsedOfWriteCount = block.execution_cost_write_count / 15000;
  //   const percentageUsedOfWriteLength = block.execution_cost_write_length / 15000000;
  //   // console.log('runtime total cost-->', totalRuntimeCost);
  //   // console.log('readCount total cost-->', readCountCostArray);
  //   // console.log('writeCount total cost-->', writeCountCostArray);
  //   // console.log('runtime total cost-->', runtimeCostArray);
  //   console.log('percentageUsedOfRuntime-->', percentageUsedOfRuntime);
  //   console.log('percentageUsedOfReadCount-->', percentageUsedOfReadCount);
  //   console.log('percentageUsedOfReadLength-->', percentageUsedOfReadLength);
  //   console.log('percentageUsedOfWriteCount-->', percentageUsedOfWriteCount);
  //   console.log('percentageUsedOfWriteLength-->', percentageUsedOfWriteLength);
  //   const percentageUsed = (percentageUsedOfRuntime + percentageUsedOfReadCount + percentageUsedOfReadLength + percentageUsedOfWriteCount + percentageUsedOfWriteLength) / 5;
  //   console.log('average precentage used of Block-->', percentageUsed * 100);
  //   return percentageUsed * 100;
  // }

    // ORIGINAL
  // public async $getBlockExtended(block: Block, transactions) {
  //   try {
  //     const blockExtended: any = Object.assign({ extras: {} }, block);
  //     const allFees = await this.$iterateThoughTransactions(transactions);
  //     if (allFees) {
  //       blockExtended.extras = this.calcFeeRange(allFees);
  //       blockExtended.extras.usd = await this.$getStacksPrice();
  //     }
  //     return blockExtended;
  //   } catch (error) {
  //     console.log('error in $getBlockExtended-->', error);
  //   }
  // }

  // public async $iterateThoughTransactions(transactionArray): Promise<TransactionData[] | undefined> {
  //   try {
  //     const result = Promise.all(transactionArray.map( async transaction => {
  //       // const value = await this.$getTransactionFee(transaction);
  //       // const value = await this.$getTransactionRuntimeCost(transaction);
  //       const value = await this.$getTransactionData(transaction);
  //       return value;
  //   }));
  //     return result;
  //   } catch (error) {
  //     console.log('Error in iterateThroughTransactions', error);
  //   }
  // }
  public async $getTransactionData(transaction) {
    try {
      const { data } = await axios.get(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/${transaction}`);
      return {
        fee_rate: Number(data.fee_rate),
      }
    } catch (error) {
      console.log('Error in $getTransactionData-->', error);
    }
  }
  // public calcFeeRange(transactionExtras: TransactionData[]) {
  //   const feeArray = transactionExtras.map(extra => extra.fee_rate);
  //   const filteredArray = feeArray.filter(fee => fee !== 0);
  //   const averageFee = filteredArray.reduce((a: number, b: number): number => a + b) / filteredArray.length;
  //   const totalFees = filteredArray.reduce((a, b) => a + b);
  //   //iterate through the filteredArray
  //     //divide the current fee by the totalFees
  //     //push the result to an array
  //   // find the average fee
  //   //Total Fees / Total Cost of Block
  //   const feePercentages = filteredArray.map(fee => fee / totalFees);
  //   const avgFeeRate = feePercentages.reduce((a, b) => a + b) / 2;

  //   let feeMedian: number = 0;

  //   filteredArray.sort((a, b) => a - b);
  //   if (filteredArray.length > 1){
  //     const midpoint = Math.floor(filteredArray.length / 2);
  //     const median = filteredArray.length % 2 === 1 ?
  //       filteredArray[midpoint] :
  //       (filteredArray[midpoint - 1] + filteredArray[midpoint]) / 2;
  //     feeMedian = median;
  //   }
  //   const sortedArray = [...new Set(filteredArray)];
  //   let lowestFee: number;
  //   if(sortedArray[0] === 0) {
  //     lowestFee = sortedArray[1];
  //   }
  //   else {
  //     lowestFee = sortedArray[0];
  //   }
  //   const highestFee = sortedArray[sortedArray.length - 1];
  //   const range = highestFee - lowestFee;
  //   return {
  //     avgFee: averageFee,
  //     feeRange: sortedArray,
  //     totalFees: totalFees,
  //     medianFee: feeMedian,
  //     avgFeeRate: avgFeeRate * 100,
  //   };
  // }
  /* ORIGINAL
  public calcFeeRange(feeArray: number[]) {
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
  */

  // public iterateThroughBlocks(blocks: Block[]) {
  //   const arrayOfFees: any = [];
  //   blocks.forEach(async (block: Block) => {
  //      arrayOfFees.push(this.iterateThoughTransactions(block.txs));
  //   });
  //   return arrayOfFees;
  // }
  public async $getTransactionFee(transaction) {
    try {
      const { data } = await axios.get(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/${transaction}`);
      return Number(data.fee_rate);
    } catch (error) {
      console.log(error);
    }
  }
  

  // public async $getTransactions(blocks) {
  //   return blocks.map(block => {
  //     return block.txs;
  //   });
  // }
  
  public async $getTransactionRuntimeCost(transaction) {
    const { data } = await axios.get(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/${transaction}`);
    return {
      execution_cost_read_count: data.execution_cost_read_count,
      execution_cost_read_length: data.execution_cost_read_length,
      execution_cost_runtime: data.execution_cost_runtime,
      execution_cost_write_count: data.execution_cost_write_count,
      execution_cost_write_length: data.execution_cost_write_length,
    };
  }

  /*
  feeRange () {
    this.fees$.subscribe((event) => {
      // console.log('fees', this.fees)
      //  this.fees.sort((a, b) => a - b);
      this.blocks[0].extras.feeRange.sort((a: number, b: number) => a - b);

      // console.log('param-->', this.fees[1]);

      // const lowestFee = this.fees[0];
      const lowestFee = this.blocks[0].extras.feeRange[0];

      console.log('lowestFee-->', lowestFee);
      // const highestFee = this.fees[this.fees.length - 1];
      const highestFee = this.blocks[0].extras.feeRange[this.blocks[0].extras.feeRange.length - 1];

      console.log('highestFee-->', highestFee);
      const range = highestFee - lowestFee;
      console.log('range-->', range);
      // const averageFee = (this.fees.reduce((a: number, b: number): number => a + b) / 2);
      const averageFee = (this.blocks[0].extras.feeRange.reduce((a: number, b: number): number => a + b) / 2);
      this.blocks[0].extras.avgFee = averageFee;
      if (this.blocks[0].extras.feeRange.length > 1){
        const midpoint = Math.floor(this.blocks[0].extras.feeRange.length / 2);
        const median = this.blocks[0].extras.feeRange.length % 2 === 1 ?
          this.blocks[0].extras.feeRange[midpoint] :
          (this.blocks[0].extras.feeRange[midpoint - 1] + this.blocks[0].extras.feeRange[midpoint]) / 2;
        this.blocks[0].extras.medianFee = median;
      }
      console.log('averageFee-->', averageFee);
    })
  */
}

export default new StacksRoutes();