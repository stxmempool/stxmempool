import { Application, Request, Response } from 'express';
import { StacksTransactionExtended } from './stacks-api.interface';

import config from '../../config';
import stacksBlocks from './stacks-blocks';
import loadingIndicators from '../loading-indicators';
import transactionUtils from '../transaction-utils';
import logger from '../../logger';
import stacksApi from './stacks-api';


class StacksRoutes {

  public initRoutes(app: Application): void {
    app
      .get(config.MEMPOOL.API_URL_PREFIX + 'stacks/block/:hash', this.getBlock)
      .get(config.MEMPOOL.API_URL_PREFIX + 'stacks/block/:hash/summary', this.getStrippedBlockTransactions)
      .get(config.MEMPOOL.API_URL_PREFIX + 'stacks/block/:hash/txs/:index', this.getBlockTransactions)
      .get(config.MEMPOOL.API_URL_PREFIX + 'stacks/tx/:txId', this.getTransaction)
      .get(config.MEMPOOL.API_URL_PREFIX + 'stacks/address/:address', this.getAddress)
      .get(config.MEMPOOL.API_URL_PREFIX + 'stacks/address/:address/txs', this.getAddressTransactions)
      .get(config.MEMPOOL.API_URL_PREFIX + 'stacks/address/:address/txs/:offset', this.getAddressTransactions)
      .get(config.MEMPOOL.API_URL_PREFIX + 'stacks/address-prefix/:prefix', this.getAddressPrefix)
      .get(config.MEMPOOL.API_URL_PREFIX + 'stacks/block-height/:height', this.getBlockHashByHeight)
      ;

  }

  private async getStrippedBlockTransactions(req: Request, res: Response): Promise<void> {
    try {
      const transactions = await stacksBlocks.$getStrippedBlockTransactions(req.params.hash);
      res.setHeader('Expires', new Date(Date.now() + 1000 * 3600 * 24 * 30).toUTCString());
      res.json(transactions);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async getBlock(req: Request, res: Response): Promise<void> {
    try {
      const block = await stacksBlocks.$getBlock(req.params.hash);

      const blockAge = new Date().getTime() / 1000 - block.timestamp;
      const day = 24 * 3600;
      let cacheDuration;
      if (blockAge > 365 * day) {
        cacheDuration = 30 * day;
      } else if (blockAge > 30 * day) {
        cacheDuration = 10 * day;
      } else {
        cacheDuration = 600;
      }

      res.setHeader('Expires', new Date(Date.now() + 1000 * cacheDuration).toUTCString());
      res.json(block);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async getBlockTransactions(req: Request, res: Response): Promise<void> {
    try {
      loadingIndicators.setProgress('blocktxs-' + req.params.hash, 0);

      const txIds = await stacksApi.$getTxIdsForBlock(req.params.hash);
      const verboseTransaction = await stacksApi.$getVerboseTransactions(txIds);
      const transactions: StacksTransactionExtended[] = [];
      const startingIndex = Math.max(0, parseInt(req.params.index || '0', 10));

      const endIndex = Math.min(startingIndex + 10, txIds.length);
      if (verboseTransaction) {
        for (let i = startingIndex; i < endIndex; i++) {
          try {
            const transaction = await transactionUtils.$getStacksTransactionExtended(txIds[i], verboseTransaction[txIds[i]].result);
            transactions.push(transaction);
            loadingIndicators.setProgress('blocktxs-' + req.params.hash, (i - startingIndex + 1) / (endIndex - startingIndex) * 100);
          } catch (e) {
            logger.debug('getBlockTransactions error: ' + (e instanceof Error ? e.message : e));
          }
        }
      }
      res.json(transactions);
    } catch (e) {
      loadingIndicators.setProgress('blocktxs-' + req.params.hash, 100);
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async getTransaction(req: Request, res: Response): Promise<void> {
    try {
      const transaction = await transactionUtils.$getStacksMempoolTransactionExtended(req.params.txId);
      res.json(transaction);
    } catch (e) {
      let statusCode = 500;
      if (e instanceof Error && e instanceof Error && e.message && e.message.indexOf('No such mempool or blockchain transaction') > -1) {
        statusCode = 404;
      }
      res.status(statusCode).send(e instanceof Error ? e.message : e);
    }
  }
  
  private async getAddress(req: Request, res: Response): Promise<void | Response> {
    try {
      const addressData = await stacksApi.$getAddress(req.params.address);
      res.json(addressData);
    } catch (e) {
      if (e instanceof Error && e.message && (e.message.indexOf('too long') > 0 || e.message.indexOf('confirmed status') > 0)) {
        return res.status(413).send(e instanceof Error ? e.message : e);
      }
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async getAddressTransactions(req: Request, res: Response): Promise<void | Response> {
    try {
      const transactions = await stacksApi.$getAddressTransactions(req.params.address, req.params.offset);
      res.json(transactions);
    } catch (e) {
      if (e instanceof Error && e.message && (e.message.indexOf('too long') > 0 || e.message.indexOf('confirmed status') > 0)) {
        return res.status(413).send(e instanceof Error ? e.message : e);
      }
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async getAddressPrefix(req: Request, res: Response): Promise<void> {
    try {
      const blockHash = await stacksApi.$getAddressPrefix(req.params.prefix);
      res.send(blockHash);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public async getBlockHashByHeight(req: Request, res: Response): Promise<void> {
    try {
      const height = parseInt(req.params.height);
      const block = await stacksApi.$getBlockByHeight(height);
      res.send(block.hash);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }
  
}

export default new StacksRoutes();