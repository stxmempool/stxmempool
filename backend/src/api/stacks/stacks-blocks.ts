import config from '../../config';
import stacksApi from './stacks-api';
import bitcoinApi from '../bitcoin/bitcoin-api-factory';
import bitcoinClient from '../bitcoin/bitcoin-client';
import BitcoinApi from '../bitcoin/bitcoin-api';
import loadingIndicators from '../loading-indicators';
import transactionUtils from '../transaction-utils';
import { Block } from '@stacks/stacks-blockchain-api-types';
import { StacksBlockExtended, StacksTransactionExtended, StacksBlockSummary, StacksTransactionStripped } from './stacks-api.interface';
import StacksBlocksRepository from '../../repositories/StacksBlocksRepository';
import { prepareStacksBlock } from '../../utils/blocks-utils';
import StacksBlocksSummariesRepository from '../../repositories/StacksBlocksSummariesRepository';
import { Common } from '../common';
import logger from '../../logger';
import stacksMempool from './stacks-mempool';
import indexer from '../../indexer';

class StacksBlocks {
  private blocks: StacksBlockExtended[] = [];
  private blockSummaries: StacksBlockSummary[] = [];
  private currentBlockHeight = 0;
  private currentDifficulty = 0;
  private currentBTCHeight = 0;
  private lastDifficultyAdjustmentTime = 0;
  private previousDifficultyRetarget = 0;
  public initialBlocks: Block[] = [];;
  public stacksBlockTip: number = 0;
  private genesisDate: Date = new Date('2021-01-14T17:28:24.000Z');

  private newBlockCallbacks: ((block: StacksBlockExtended, txIds: string[], transactions: StacksTransactionExtended[]) => void)[] = [];
  private newAsyncBlockCallbacks: ((block: StacksBlockExtended, txIds: string[], transactions: StacksTransactionExtended[]) => Promise<void>)[] = [];
  // constructor() {}

  public getBlocks(): StacksBlockExtended[] {
    return this.blocks;
  }

  public setBlocks(blocks: StacksBlockExtended[]): void {
    this.blocks = blocks;
  }

  public getBlockSummaries(): StacksBlockSummary[] {
    return this.blockSummaries;
  }

  public setBlockSummaries(blockSummaries: StacksBlockSummary[]): void {
    this.blockSummaries = blockSummaries;
  }

  public setNewBlockCallback(fn: (block: StacksBlockExtended, txIds: string[], transactions: StacksTransactionExtended[]) => void): void {
    this.newBlockCallbacks.push(fn);
  }

  public setNewAsyncBlockCallback(fn: (block: StacksBlockExtended, txIds: string[], transactions: StacksTransactionExtended[]) => Promise<void>): void {
    this.newAsyncBlockCallbacks.push(fn);
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

  /**
   * Return the list of transaction for a block
   * @param block
   * @param onlyCoinbase - Set to true if you only need the coinbase transaction
   * @returns Promise<StacksTransactionExtended[]>
   */
   private async $getTransactionsExtended(
    block: Block,
    onlyCoinbase: boolean,
    quiet: boolean = false,
  ): Promise<StacksTransactionExtended[]> {
    const transactions: StacksTransactionExtended[] = [];
    const txIds = block.txs;
    const txsVerbose = await stacksApi.$getVerboseTransactions(txIds);
    const promiseArray: Promise<StacksTransactionExtended>[] = [];

    const transactionsFound = 0;
    let transactionsFetched = 0;
    // Find coinbase transaction and return an array containing that transaction
    if (onlyCoinbase && txsVerbose) {
      for (const tx in txsVerbose) {
        if (txsVerbose[tx].result.tx_type === 'coinbase') {
          return [await transactionUtils.$getStacksTransactionExtended(tx, txsVerbose[tx].result)];
        }
      }
    }
    // In the mempool.space variation they use transactions from the mempool cache. However, STX transactions in the mempool do not have
    // execution costs. So we query the transactions again to get the new data.
    // Currently, most STX blocks exceed their execution limits around 200 transactions, which is a tenth of a typical BTC block
    if(txsVerbose) {
      // Algo for optimized query speed but will be rate limited unless you have a dedicated API node
      if (config.STACKS.DEDICATED_API) {
        try {
          for (let i = 0; i < txIds.length; i++) {
            if (!quiet && (i % (Math.round((txIds.length) / 10)) === 0 || i + 1 === txIds.length)) { // Avoid log spam
              logger.debug(`Indexing tx ${i + 1} of ${txIds.length} in block #${block.height}`);
            }
            promiseArray.push(transactionUtils.$getStacksTransactionExtended(txsVerbose[txIds[i]].result.tx_id, txsVerbose[txIds[i]].result));
            transactionsFetched++;
          }
          return await Promise.all(promiseArray);
        } catch (e) {
          logger.err(`Cannot fetch tx. Reason: ` + (e instanceof Error ? e.message : e));
        }
      } else {
        for (let i = 0; i < txIds.length; i++) {

          if (config.MEMPOOL.BACKEND === 'none' || !stacksMempool.hasPriority() || i === 0) {
            
            if (!quiet && (i % (Math.round((txIds.length) / 10)) === 0 || i + 1 === txIds.length)) { // Avoid log spam
              logger.debug(`Indexing tx ${i + 1} of ${txIds.length} in block #${block.height}`);
            }
            try {
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
        }
      }

    }
      if (!quiet) {
        logger.debug(`${transactionsFound} of ${txIds.length} found in mempool. ${transactionsFetched} fetched through backend service.`);
      }
      return transactions;
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

  private async $getBlockExtended (block: Block, transactions: StacksTransactionExtended[]): Promise<StacksBlockExtended> {
    // this range length is used to build the feeRange
    const rangeLength = 8;
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
    blockExtended.extras.usd = await stacksApi.$getStacksPrice();
    blockExtended.size = transactions.map(tx => tx.vsize).reduce((acc, curr) => acc + curr);
    if (block.height === 0) {
      blockExtended.extras.medianFee = 0; // 50th percentiles
      blockExtended.extras.feeRange = [0, 0, 0, 0, 0, 0, 0];
      blockExtended.extras.totalFees = 0;
      blockExtended.extras.avgFee = 0;
      blockExtended.extras.avgFeeRate = 0;
    } else if (block.txs.length === 1) {
      // accounting for blocks that only have a coinbase transaction
      blockExtended.extras.medianFee = 0;
      blockExtended.extras.feeRange = [0, 0, 0, 0, 0, 0, 0];
      blockExtended.extras.totalFees = 0;
      blockExtended.extras.avgFee = 0;
      blockExtended.extras.avgFeeRate = 0;
      return blockExtended;
    } else {

      // remove the 0 fee of a coinbase transacation
      // const feeArray = transactions.map(tx => tx.feeRateAsNumber);

      // const filteredFeeArray = transactions.map(tx => tx.feeRateAsNumber).filter(fee => fee !== 0);
      
      //TODO refactor, way too many sort functions
      const feeArray = transactions.map(tx => tx.feeRateAsNumber);
      const filteredFeeArray = feeArray.filter(fee => fee !== 0);
      filteredFeeArray.sort((a, b) => a - b);

      const feePerVSizeArray = transactions.map(tx => tx.effectiveFeePerVsize);
      feePerVSizeArray.sort((a, b) => a - b);

      transactions.sort((a, b) => b.feePerVsize - a.feePerVsize);
      // blockExtended.extras.medianFee = Common.percentile(filteredArray, config.MEMPOOL.RECOMMENDED_FEE_PERCENTILE);
      // blockExtended.extras.medianFee = Common.percentile(transactions.map((tx) => tx.effectiveFeePerVsize), config.MEMPOOL.RECOMMENDED_FEE_PERCENTILE);
      blockExtended.extras.medianFee = Common.percentile(feePerVSizeArray, config.MEMPOOL.RECOMMENDED_FEE_PERCENTILE);


      // blockExtended.extras.feeRange = filteredArray;
      blockExtended.extras.feeRange = Common.getFeesInRange(transactions, rangeLength);

      blockExtended.extras.totalFees = feeArray.reduce((acc, curr) => acc + curr);
      // this conditional prevents a rare case where there is a block with transactions but they have a feerate of zero. (See block height 3000)
      if (blockExtended.extras.totalFees === 0) {
        blockExtended.extras.avgFee = 0;
        blockExtended.extras.avgFeeRate = 0;
      } else {
        blockExtended.extras.avgFee = blockExtended.extras.totalFees / transactions.length;
        blockExtended.extras.avgFeeRate = transactions.map(tx => tx.feePerVsize).reduce((acc, curr) => acc + curr) / filteredFeeArray.length;
      }

    }

    return blockExtended;
  }

  /**
   * [INDEXING] Index all blocks summaries for the block txs visualization
   */
  public async $generateStacksBlocksSummariesDatabase(): Promise<void> {
    if (Common.stacksBlocksSummariesIndexingEnabled() === false) {
      return;
    }

    try {
      // Get all indexed block hash
      const indexedBlocks = await StacksBlocksRepository.$getIndexedBlocks();
      const indexedBlockSummariesHashesArray = await StacksBlocksSummariesRepository.$getIndexedSummariesId();

      const indexedBlockSummariesHashes = {}; // Use a map for faster seek during the indexing loop
      for (const hash of indexedBlockSummariesHashesArray) {
        indexedBlockSummariesHashes[hash] = true;
      }

      // Logging
      let newlyIndexed = 0;
      let totalIndexed = indexedBlockSummariesHashesArray.length;
      let indexedThisRun = 0;
      let timer = new Date().getTime() / 1000;
      const startedAt = new Date().getTime() / 1000;

      for (const block of indexedBlocks) {
        if (indexedBlockSummariesHashes[block.hash] === true) {
          continue;
        }

        // Logging
        const elapsedSeconds = Math.max(1, Math.round((new Date().getTime() / 1000) - timer));
        if (elapsedSeconds > 5) {
          const runningFor = Math.max(1, Math.round((new Date().getTime() / 1000) - startedAt));
          const blockPerSeconds = Math.max(1, indexedThisRun / elapsedSeconds);
          const progress = Math.round(totalIndexed / indexedBlocks.length * 10000) / 100;
          logger.debug(`Indexing block summary for #${block.height} | ~${blockPerSeconds.toFixed(2)} blocks/sec | total: ${totalIndexed}/${indexedBlocks.length} (${progress}%) | elapsed: ${runningFor} seconds`);
          timer = new Date().getTime() / 1000;
          indexedThisRun = 0;
        }

        await this.$getStrippedBlockTransactions(block.hash, true, true); // This will index the block summary

        // Logging
        indexedThisRun++;
        totalIndexed++;
        newlyIndexed++;
      }
      if (newlyIndexed > 0) {
        logger.notice(`Blocks summaries indexing completed: indexed ${newlyIndexed} blocks`);
      } else {
        logger.debug(`Blocks summaries indexing completed: indexed ${newlyIndexed} blocks`);
      }
    } catch (e) {
      logger.err(`Blocks summaries indexing failed. Trying again in 10 seconds. Reason: ${(e instanceof Error ? e.message : e)}`);
      throw e;
    }
  }

  /**
   * [INDEXING] Index all blocks metadata for the mining dashboard
   */
  public async $generateStacksBlockDatabase(): Promise<boolean> {
    try {
      // const blockchainInfo = await bitcoinClient.getBlockchainInfo();
      let currentBlockHeight = await stacksApi.$getBlockHeightTip();
      const stacksBlockHeight = currentBlockHeight;
      let indexingBlockAmount = Math.min(config.STACKS.INDEXING_BLOCKS_AMOUNT, stacksBlockHeight);
      if (indexingBlockAmount <= -1) {
        indexingBlockAmount = currentBlockHeight + 1;
      }

      const lastBlockToIndex = Math.max(0, currentBlockHeight - indexingBlockAmount + 1);

      logger.debug(`Indexing blocks from #${currentBlockHeight} to #${lastBlockToIndex}`);
      loadingIndicators.setProgress('block-indexing', 0);

      const chunkSize = 10000;
      let totalIndexed = await StacksBlocksRepository.$blockCountBetweenHeight(currentBlockHeight, lastBlockToIndex);
      let indexedThisRun = 0;
      let newlyIndexed = 0;
      const startedAt = new Date().getTime() / 1000;
      let timer = new Date().getTime() / 1000;

      while (currentBlockHeight >= lastBlockToIndex) {
        const endBlock = Math.max(0, lastBlockToIndex, currentBlockHeight - chunkSize + 1);

        const missingBlockHeights: number[] = await StacksBlocksRepository.$getMissingBlocksBetweenHeights(
          currentBlockHeight, endBlock);
        if (missingBlockHeights.length <= 0) {
          currentBlockHeight -= chunkSize;
          continue;
        }

        logger.info(`Indexing ${missingBlockHeights.length} blocks from #${currentBlockHeight} to #${endBlock}`);

        for (const blockHeight of missingBlockHeights) {
          if (blockHeight < lastBlockToIndex) {
            break;
          }
          ++indexedThisRun;
          ++totalIndexed;
          const elapsedSeconds = Math.max(1, new Date().getTime() / 1000 - timer);
          if (elapsedSeconds > 5 || blockHeight === lastBlockToIndex) {
            const runningFor = Math.max(1, Math.round((new Date().getTime() / 1000) - startedAt));
            const blockPerSeconds = Math.max(1, indexedThisRun / elapsedSeconds);
            const progress = Math.round(totalIndexed / indexingBlockAmount * 10000) / 100;
            logger.debug(`Indexing block #${blockHeight} | ~${blockPerSeconds.toFixed(2)} blocks/sec | total: ${totalIndexed}/${indexingBlockAmount} (${progress}%) | elapsed: ${runningFor} seconds`);
            timer = new Date().getTime() / 1000;
            indexedThisRun = 0;
            loadingIndicators.setProgress('block-indexing', progress, false);
          }
          // const blockHash = await bitcoinApi.$getBlockHash(blockHeight);
          // const block = BitcoinApi.convertBlock(await bitcoinClient.getBlock(blockHash));
          const block = await stacksApi.$getBlockByHeight(blockHeight);
          const transactions = await this.$getTransactionsExtended(block, false);
          const blockExtended = await this.$getBlockExtended(block, transactions);

          newlyIndexed++;
          await StacksBlocksRepository.$saveBlockInDatabase(blockExtended);
        }

        currentBlockHeight -= chunkSize;
      }
      if (newlyIndexed > 0) {
        logger.notice(`Block indexing completed: indexed ${newlyIndexed} blocks`);
      } else {
        logger.debug(`Block indexing completed: indexed ${newlyIndexed} blocks`);
      }
      loadingIndicators.setProgress('block-indexing', 100);
    } catch (e) {
      logger.err('Block indexing failed. Trying again in 10 seconds. Reason: ' + (e instanceof Error ? e.message : e));
      loadingIndicators.setProgress('block-indexing', 100);
      throw e;
    }

    return await StacksBlocksRepository.$validateChain();
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

  public async $updateBlocks(): Promise<void> {
    let fastForwarded = false;
    const blockHeightTip = await stacksApi.$getBlockHeightTip();
    this.currentBTCHeight = await bitcoinApi.$getBlockHeightTip();
    if (this.blocks.length === 0) {
      this.currentBlockHeight = Math.max(blockHeightTip - config.STACKS.INITIAL_BLOCKS_AMOUNT, -1);

    } else {
      this.currentBlockHeight = this.blocks[this.blocks.length - 1].height;
    }

    if (blockHeightTip - this.currentBlockHeight > config.STACKS.INITIAL_BLOCKS_AMOUNT * 2) {
      logger.info(`${blockHeightTip - this.currentBlockHeight} blocks since tip. Fast forwarding to the ${config.MEMPOOL.INITIAL_BLOCKS_AMOUNT} recent blocks`);
      this.currentBlockHeight = blockHeightTip - config.STACKS.INITIAL_BLOCKS_AMOUNT;
      fastForwarded = true;
      logger.info(`Re-indexing skipped blocks and corresponding hashrates data`);
      indexer.reindex(); // Make sure to index the skipped blocks #1619
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
      const block = await stacksApi.$getBlockByHeight(this.currentBlockHeight);
      const txIds = block.txs;
      
      const transactions = await this.$getTransactionsExtended(block, false);
      const blockExtended: StacksBlockExtended = await this.$getBlockExtended(block, transactions);

      const blockSummary: StacksBlockSummary = this.summarizeBlock(block, transactions);

      // start async callbacks
      const callbackPromises = this.newAsyncBlockCallbacks.map((cb) => cb(blockExtended, txIds, transactions));

      if (Common.indexingEnabled()) {
        if (!fastForwarded) {
          const lastBlock = await StacksBlocksRepository.$getBlockByHeight(blockExtended.height - 1);
          if (lastBlock !== null && blockExtended.previousblockhash !== lastBlock['hash']) {
            logger.warn(`Chain divergence detected at block ${lastBlock['height']}, re-indexing most recent data`);
            // We assume there won't be a reorg with more than 10 block depth
            await StacksBlocksRepository.$deleteBlocksFrom(lastBlock['height'] - 10);
            await StacksBlocksSummariesRepository.$deleteBlocksFrom(lastBlock['height'] - 10);
            for (let i = 10; i >= 0; --i) {
              const newBlock = await this.$indexBlock(lastBlock['height'] - i);
              await this.$getStrippedBlockTransactions(newBlock.id, true, true);
            }
            logger.info(`Re-indexed 10 blocks and summaries. Also re-indexed the last difficulty adjustments. Will re-index latest hashrates in a few seconds.`);
            indexer.reindex();
          }
          await StacksBlocksRepository.$saveBlockInDatabase(blockExtended);

          /* We currently are not implementing a stacks_blocks_prices table as its utility is unclear at the moment
          const lastestPriceId = await PricesRepository.$getLatestPriceId();
          if (priceUpdater.historyInserted === true && lastestPriceId !== null) {
            await blocksRepository.$saveBlockPrices([{
              height: blockExtended.height,
              priceId: lastestPriceId,
            }]);
          } else {
            logger.info(`Cannot save block price for ${blockExtended.height} because the price updater hasnt completed yet. Trying again in 10 seconds.`)
            setTimeout(() => {
              indexer.runSingleTask('blocksPrices');
            }, 10000);
          }
          */

          // Save blocks summary for visualization if it's enabled
          if (Common.blocksSummariesIndexingEnabled() === true) {
            await this.$getStrippedBlockTransactions(blockExtended.id, true);
          }
        }
      }

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
      // TODO implement diskCache
      // if (!stacksMempool.hasPriority()) {
      //   diskCache.$saveCacheToDisk();
      // }

      // wait for pending async callbacks to finish
      await Promise.all(callbackPromises);
    }
  }
  /**
   * Index a block if it's missing from the database. Returns the block after indexing
   */
  public async $indexBlock (height: number): Promise<StacksBlockExtended> {
    const dbBlock = await StacksBlocksRepository.$getBlockByHeight(height);
    if (dbBlock !== null) {
      return prepareStacksBlock(dbBlock);
    }
    const block = await stacksApi.$getBlockByHeight(height);
    const transacations = await this.$getTransactionsExtended(block, false);
    const blockExtended = await this.$getBlockExtended(block, transacations);

    await StacksBlocksRepository.$saveBlockInDatabase(blockExtended);
    return prepareStacksBlock(blockExtended);
  }

  public async $getBlock(hash: string): Promise<StacksBlockExtended> {
    // Check the memory cache
    const blockByHash = this.getBlocks().find((b) => b.id === hash);
    if (blockByHash) {
      return blockByHash;
    }

     // Block has already been indexed
     if (Common.indexingEnabled()) {
      const dbBlock = await StacksBlocksRepository.$getBlockByHash(hash);
      if (dbBlock !== null) {
        return prepareStacksBlock(dbBlock);
      }
    }

    
    const block = await stacksApi.$getBlockByHash(hash);
    const transactions = await this.$getTransactionsExtended(block, false);
    const blockExtended = await this.$getBlockExtended(block, transactions);

    if (Common.indexingEnabled()) {
      await StacksBlocksRepository.$saveBlockInDatabase(blockExtended);
    }

    return prepareStacksBlock(blockExtended);
  }
  
  public async $getStrippedBlockTransactions(hash: string, skipMemoryCache = false, skipDBLookup = false): Promise<StacksTransactionStripped[] | undefined> {
    if (skipMemoryCache === false) {
      // Check the memory cache
      const cachedSummary = this.getBlockSummaries().find((b) => b.id === hash);
      if (cachedSummary?.transactions?.length) {
        return cachedSummary.transactions;
      }
    }
    // Check if it's indexed in db
    console.log('Common.stacksBlocksSummariesIndexingEnabled()-->', Common.stacksBlocksSummariesIndexingEnabled());
    if (skipDBLookup === false && Common.stacksBlocksSummariesIndexingEnabled() === true) {
      const indexedSummary = await StacksBlocksSummariesRepository.$getByBlockId(hash);
      console.log('indexedSummary-->', indexedSummary);
      if (indexedSummary !== undefined && indexedSummary?.transactions?.length) {
        return indexedSummary.transactions;
      }
    }

    // Call API
    const block = await stacksApi.$getBlockByHash(hash);
    const transactions = await this.$getTransactionsExtended(block, false);
    const summary = this.summarizeBlock(block, transactions);

    // Index the response if needed
    if (Common.stacksBlocksSummariesIndexingEnabled() === true) {
      await StacksBlocksSummariesRepository.$saveSummary({height: block.height, mined: summary});
    }

    return summary.transactions;
  }
  public async $getBlocks(fromHeight?: number, limit: number = 15): Promise<StacksBlockExtended[]> {
    let currentHeight = fromHeight !== undefined ? fromHeight : await StacksBlocksRepository.$mostRecentBlockHeight();
    const returnBlocks: StacksBlockExtended[] = [];

    if (currentHeight < 0) {
      return returnBlocks;
    }

    // Check if block height exist in local cache to skip the hash lookup
    const blockByHeight = this.getBlocks().find((b) => b.height === currentHeight);
    let startFromHash: string | null = null;
    if (blockByHeight) {
      startFromHash = blockByHeight.id;
    } else if (!Common.indexingEnabled()) {
      // startFromHash = await bitcoinApi.$getBlockHash(currentHeight);
      const result = await stacksApi.$getBlockByHeight(currentHeight);
      startFromHash = result.hash;
    }

    let nextHash = startFromHash;
    for (let i = 0; i < limit && currentHeight >= 0; i++) {
      let block = this.getBlocks().find((b) => b.height === currentHeight);
      if (block) {
        returnBlocks.push(block);
      } else if (Common.indexingEnabled()) {
        block = await this.$indexBlock(currentHeight);
        returnBlocks.push(block);
      } else if (nextHash !== null) {
        const nextBlock = await stacksApi.$getBlockByHash(nextHash);
        const transactions = await this.$getTransactionsExtended(nextBlock, false);
        const blockExtended = await this.$getBlockExtended(nextBlock, transactions);
        block = prepareStacksBlock(blockExtended);
        nextHash = block.previousblockhash;
        returnBlocks.push(block);
      }
      currentHeight--;
    }

    return returnBlocks;
  }
}

export default new StacksBlocks();