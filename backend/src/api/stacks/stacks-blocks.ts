import config from '../../config';
import stacksApi from './stacks-api';
import bitcoinApi from '../bitcoin/bitcoin-api-factory';
import bitcoinClient from '../bitcoin/bitcoin-client';
import BitcoinApi from '../bitcoin/bitcoin-api';
import loadingIndicators from '../loading-indicators';
import transactionUtils from '../transaction-utils';
import { VbytesPerSecond } from '../../mempool.interfaces';
import { Block, MempoolTransactionListResponse, Transaction, MempoolTransaction } from '@stacks/stacks-blockchain-api-types';
import { BlockExtension, CustomTransactionList, StacksBlockExtended, StacksTransactionExtended, StacksBlockSummary, StacksTransactionDataWithSize, StacksTransactionStripped } from './stacks-api.interface';


import { Common } from '../common';
import logger from '../../logger';
import axios from 'axios';
import stacksMempool from './stacks-mempool';

class StacksBlocks {
  private blocks: StacksBlockExtended[] = [];
  private blockSummaries: StacksBlockSummary[] = [];
  private currentBlockHeight = 0;
  private currentDifficulty = 0;
  private currentBTCHeight = 0;
  private lastDifficultyAdjustmentTime = 0;
  private previousDifficultyRetarget = 0;
  public initialBlocks: Block[] = [];
  public extendedBlocks: StacksBlockExtended[] = [];
  public stacksBlockTip: number = 0;
  private counter: number = 1;
  private genesisDate: Date = new Date('2021-01-14T17:28:24.000Z');

  private newBlockCallbacks: ((block: StacksBlockExtended, txIds: string[], transactions: StacksTransactionExtended[]) => void)[] = [];
  private newAsyncBlockCallbacks: ((block: StacksBlockExtended, txIds: string[], transactions: StacksTransactionExtended[]) => Promise<void>)[] = [];
  constructor() {}

  /*  NON ASYNC FUNCTIONS   */
  public getBlocks(): StacksBlockExtended[] {
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
  public setBlocks(blocks: StacksBlockExtended[]) {
    this.blocks = blocks;
  }
  
  public getExtendedBlocks(): StacksBlockExtended[] {
    return this.extendedBlocks;
  }
  public getBlockSummaries(): StacksBlockSummary[] {
    return this.blockSummaries;
  }
  public setBlockSummaries(blockSummaries: StacksBlockSummary[]) {
    this.blockSummaries = blockSummaries;
  }
  public setNewBlockCallback(fn: (block: StacksBlockExtended, txIds: string[], transactions: StacksTransactionExtended[]) => void) {
    this.newBlockCallbacks.push(fn);
  }

  public setNewAsyncBlockCallback(fn: (block: StacksBlockExtended, txIds: string[], transactions: StacksTransactionExtended[]) => Promise<void>) {
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
   * @returns Promise<StacksTransactionExtended[]>
   */
   private async $getTransactionsExtended(
    // blockHash: string,
    // blockHeight: number,
    block: Block,
    onlyCoinbase: boolean,
    quiet: boolean = false,
  ): Promise<StacksTransactionExtended[]> {
    const transactions: StacksTransactionExtended[] = [];
    // const txIds: string[] = await stacksApi.$getTxIdsForBlock(block.hash);
    const txIds = block.txs;
    const txsVerbose = await stacksApi.$getVerboseTransactions(txIds);

    const mempool = stacksMempool.getMempool();
    let transactionsFound = 0;
    let transactionsFetched = 0;
    if(txsVerbose) {
      for (let i = 0; i < txIds.length; i++) {
        // if (mempool[txIds[i]]) {
        // if (mempool[txsVerbose[txIds[i]].result.tx_id]) {

        //   // We update blocks before the mempool (index.ts), therefore we can
        //   // optimize here by directly fetching txs in the "outdated" mempool
        //   transactions.push(mempool[txIds[i]]);
        //   transactionsFound++;
        // } else if (config.MEMPOOL.BACKEND === 'none' || !stacksMempool.hasPriority() || i === 0) {
        if (config.MEMPOOL.BACKEND === 'none' || !stacksMempool.hasPriority() || i === 0) {
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
    }
      if (!quiet) {
        logger.debug(`${transactionsFound} of ${txIds.length} found in mempool. ${transactionsFetched} fetched through backend service.`);
      }
    
      return transactions;
  }
  // TODO remove this
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
      this.currentBlockHeight = Math.max(blockHeightTip - config.STACKS.INITIAL_BLOCKS_AMOUNT, -1);

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
      const blockExtended: StacksBlockExtended = await this.$getBlockExtendedTest(block, transactions);

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
   * @param transactions
   * @returns StacksBlockSummary
   */
  private summarizeBlock(block: Block, transactions: StacksTransactionExtended[]): StacksBlockSummary {
    const stripped = transactions.map(tx => {
      return {
        txid: tx.tx_id,
        vsize: tx.vsize,
        fee: tx.feeRateAsNumber,
        type: tx.tx_type,
        execution_cost_read_count: tx.execution_cost_read_count,
      };
    });
    return {
      id: block.hash,
      transactions: stripped,
    };
  }
  private async $getBlockExtendedTest (block: Block, transactions: StacksTransactionExtended[]): Promise<StacksBlockExtended> { //Promise<StacksBlockExtended> {
    const minerAddress = transactions.filter(transaction => transaction.tx_type === 'coinbase');
    const blockExtended: StacksBlockExtended = Object.assign({
      tx_count: block.txs.length,
      id: block.hash,
      timestamp: block.burn_block_time,
      previousblockhash: block.parent_block_hash,
      minerAddress: minerAddress[0].sender_address,
      extras: {
        reward: this.getReward() * 1000000
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
      // const feeArray = transactions.map(tx => tx.feeRateAsNumber);

      //TODO refactor, way too many sort functions
      const feeArray = transactions.map(tx => tx.feeRateAsNumber);
      const feePerVSizeArray = transactions.map(tx => tx.effectiveFeePerVsize);
      feePerVSizeArray.sort((a, b) => a - b);
      const filteredArray = feeArray.filter(fee => fee !== 0);
      // change this later
      const rangeLength = 8;
      filteredArray.sort((a, b) => a - b);
      transactions.sort((a, b) => b.feePerVsize - a.feePerVsize);
      // blockExtended.extras.medianFee = Common.percentile(filteredArray, config.MEMPOOL.RECOMMENDED_FEE_PERCENTILE);
      // blockExtended.extras.medianFee = Common.percentile(transactions.map((tx) => tx.effectiveFeePerVsize), config.MEMPOOL.RECOMMENDED_FEE_PERCENTILE);
      blockExtended.extras.medianFee = Common.percentile(feePerVSizeArray, config.MEMPOOL.RECOMMENDED_FEE_PERCENTILE);


      // blockExtended.extras.feeRange = filteredArray;
      blockExtended.extras.feeRange = Common.getFeesInRange(transactions, rangeLength);

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
  // TODO Remove
  // public async $getBlockExtended(block: StacksBlockExtended, transactions: string[]): Promise<StacksBlockExtended | undefined> {
  //   try {
  //     const blockExtended: StacksBlockExtended = Object.assign({ extras: {} }, block);
  //     const transactionsData = await this.$iterateThroughTransactions(transactions);
  //     if (transactionsData) {
  //       // console.log(transactionsData);
  //       // const totalRuntime = allFees.reduce((a, b) => a + b);
  //       // const percentageofTotalRuntime = totalRuntime / 5000000000;
  //       // console.log('totalRuntime-->', allFees);
  //       // console.log(transactionsData);
  //       // blockExtended.totalRuntime = this.calcCost(transactionsData);
  //       const sizes = transactionsData.map(data => data.size);
  //       blockExtended.extras = this.calcFeeRange(transactionsData);
  //       blockExtended.size = sizes.reduce((acc, curr) => acc + curr);
  //       blockExtended.extras.usd = await stacksApi.$getStacksPrice();
  //     }
  //     return blockExtended;
  //   } catch (error) {
  //     console.log('error in $getBlockExtended-->', error);
  //   }
  // }

  // TODO Need to finish this function to include a DB solution

  public async $getBlock(hash: string): Promise<StacksBlockExtended> {
    const blockByHash = this.getBlocks().find((b) => b.id === hash);
    if (blockByHash) {
      return blockByHash;
    }
    /* This will be if I create my own DB to index
     // Block has already been indexed
     if (Common.indexingEnabled()) {
      const dbBlock = await blocksRepository.$getBlockByHash(hash);
      if (dbBlock != null) {
        return prepareBlock(dbBlock);
      }
    }

    I dont believe I need this either
    // Not Bitcoin network, return the block as it
    if (['mainnet', 'testnet', 'signet'].includes(config.MEMPOOL.NETWORK) === false) {
      return await bitcoinApi.$getBlock(hash);
    }
    */
    let block = await stacksApi.$getBlockByHash(hash);
    // block = prepareBlock(block);
    const transactions = await this.$getTransactionsExtended(block, false);
    const blockExtended = await this.$getBlockExtendedTest(block, transactions);

    return blockExtended;
  }
  
  // TODO Need to finish this function to include a DB solution
  public async $getStrippedBlockTransactions(hash: string, skipMemoryCache = false, skipDBLookup = false): Promise<StacksTransactionStripped[] | undefined> {
    if (skipMemoryCache === false) {
      // Check the memory cache
      const cachedSummary = this.getBlockSummaries().find((b) => b.id === hash);
      if (cachedSummary?.transactions?.length) {
        return cachedSummary.transactions;
      }
    }
    // Check if it's indexed in db
    // if (skipDBLookup === false && Common.blocksSummariesIndexingEnabled() === true) {
    //   const indexedSummary = await BlocksSummariesRepository.$getByBlockId(hash);
    //   if (indexedSummary !== undefined && indexedSummary?.transactions?.length) {
    //     return indexedSummary.transactions;
    //   }
    // }

    // Call Core RPC
  //   const block = await stacksApi.$getBlockByHash(hash);
  //   const transactions = await stacksApi.$getVerboseTransactions(block.txs);
  //   if (transactions){
  //     const summary = this.summarizeBlockForStripped(block, transactions);

   
  // }
    // Index the response if needed
    // if (Common.blocksSummariesIndexingEnabled() === true) {
    //   await BlocksSummariesRepository.$saveSummary({height: block.height, mined: summary});
    // }

    // return summary.transactions;
  }
  // public async summarizeBlockForStripped (block: Block, transactions: CustomTransactionList) {
  //   for (const txId in transactions) {
  //     try {
  //       const txSize = await stacksApi.$getTransactionSize(txId);
  //       transactions[txId].result.size = txSize;
  //     } catch (error) {
  //       console.log(error);
  //     }
  //   }
  // }
}

export default new StacksBlocks();