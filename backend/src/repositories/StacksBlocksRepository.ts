import { BlockExtended, BlockPrice } from '../mempool.interfaces';
import DB from '../database';
import logger from '../logger';
import { Common } from '../api/common';
import { prepareBlock } from '../utils/blocks-utils';
import { escape } from 'mysql2';
import { StacksBlockExtended } from '../api/stacks/stacks-api.interface';
import StacksBlocksSummariesRepository from './StacksBlocksSummariesRepository';

class StacksBlockRepository {
  /**
   * Save indexed block data in the database
   */
  public async $saveBlockInDatabase (block: StacksBlockExtended) {
    try {
      const query = `INSERT INTO stacks_blocks(
        height,                     hash,                       blockTimestamp,               burn_block_hash,
        size,                       miner_address,              tx_count,                     transactions,
        fees,                       fee_span,                   median_fee,                   reward,
        parent_block_hash,          avg_fee,                    avg_fee_rate,                 execution_cost_read_count,
        execution_cost_read_length, execution_cost_runtime,     execution_cost_write_count,   execution_cost_write_length
      ) VALUE (
        ?, ?, FROM_UNIXTIME(?), ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
      )`;
      const params: any[] = [
        block.height,
        block.hash,
        block.timestamp,
        block.burn_block_hash,
        block.size,
        block.minerAddress,
        block.tx_count,
        JSON.stringify(block.txs),
        block.extras.totalFees,
        JSON.stringify(block.extras.feeRange),
        block.extras.medianFee,
        block.extras.reward,
        block.parent_block_hash,
        block.extras.avgFee,
        block.extras.avgFeeRate,
        block.execution_cost_read_count,
        block.execution_cost_read_length,
        block.execution_cost_runtime,
        block.execution_cost_write_count,
        block.execution_cost_write_length,
      ];
      await DB.query(query, params);
    } catch (e: any) {
      if (e.errno === 1062) { // ER_DUP_ENTRY - This scenario is possible upon node backend restart
        logger.debug(`$saveBlockInDatabase() - Block ${block.height} has already been indexed, ignoring`);
      } else {
        logger.err('Cannot save indexed block into db. Reason: ' + (e instanceof Error ? e.message : e));
        throw e;
      }
    }
  }
  /**
   * Get one block by height
   */
   public async $getBlockByHeight(height: number): Promise<object | null> {
    try {
      const [rows]: any[] = await DB.query(`SELECT
        stacks_blocks.height,
        hash,
        hash as id,
        UNIX_TIMESTAMP(stacks_blocks.blockTimestamp) as blockTimestamp,
        burn_block_hash,
        size,
        miner_address,
        tx_count,
        transactions,
        fees,
        fee_span,
        median_fee,
        reward,
        parent_block_hash,
        avg_fee,
        avg_fee_rate,
        execution_cost_read_count,
        execution_cost_read_length,
        execution_cost_runtime,
        execution_cost_write_count,
        execution_cost_write_length
        FROM stacks_blocks
        WHERE stacks_blocks.height = ${height}
      `);

      if (rows.length <= 0) {
        return null;
      }

      rows[0].fee_span = JSON.parse(rows[0].fee_span);
      return rows[0];
    } catch (e) {
      logger.err(`Cannot get indexed block ${height}. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }
  public async $getBlockByHash(hash: string): Promise<object | null> {
    try {
      const query = `
        SELECT *, stacks_blocks.height, UNIX_TIMESTAMP(stacks_blocks.blockTimestamp) as blockTimestamp, hash as id,
        parent_block_hash as previousblockhash
        FROM stacks_blocks
        WHERE hash = ?;
      `;
      const [rows]: any[] = await DB.query(query, [hash]);

      if (rows.length <= 0) {
        return null;
      }

      rows[0].fee_span = JSON.parse(rows[0].fee_span);
      return rows[0];
    } catch (e) {
      logger.err(`Cannot get indexed block ${hash}. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }
  /**
   * Get a list of blocks that have been indexed
   */
    public async $getIndexedBlocks(): Promise<any[]> {
      try {
        const [rows]: any = await DB.query(`SELECT height, hash FROM stacks_blocks ORDER BY height DESC`);
        return rows;
      } catch (e) {
        logger.err('Cannot generate block size and weight history. Reason: ' + (e instanceof Error ? e.message : e));
        throw e;
      }
    }
  /**
   * Get blocks count for a period
   */
  public async $blockCountBetweenHeight(startHeight: number, endHeight: number): Promise<number> {
    const params: any[] = [];
    let query = `SELECT count(height) as blockCount
      FROM stacks_blocks
      WHERE height <= ${startHeight} AND height >= ${endHeight}`;

    try {
      const [rows] = await DB.query(query, params);
      return <number>rows[0].blockCount;
    } catch (e) {
      logger.err(`Cannot count blocks for this pool (using offset). Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }
  /**
   * Get all block height that have not been indexed between [startHeight, endHeight]
   */
  public async $getMissingBlocksBetweenHeights(startHeight: number, endHeight: number): Promise<number[]> {
    if (startHeight < endHeight) {
      return [];
    }

    try {
      const [rows]: any[] = await DB.query(`
        SELECT height
        FROM stacks_blocks
        WHERE height <= ? AND height >= ?
        ORDER BY height DESC;
      `, [startHeight, endHeight]);

      const indexedBlockHeights: number[] = [];
      rows.forEach((row: any) => { indexedBlockHeights.push(row.height); });
      const seekedBlocks: number[] = Array.from(Array(startHeight - endHeight + 1).keys(), n => n + endHeight).reverse();
      const missingBlocksHeights = seekedBlocks.filter(x => indexedBlockHeights.indexOf(x) === -1);

      return missingBlocksHeights;
    } catch (e) {
      logger.err('Cannot retrieve blocks list to index. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }
  /**
   * Check if the chain of block hash is valid and delete data from the stale branch if needed
   */
  public async $validateChain(): Promise<boolean> {
    try {
      const start = new Date().getTime();
      const [blocks]: any[] = await DB.query(`SELECT height, hash, parent_block_hash,
        UNIX_TIMESTAMP(blockTimestamp) as timestamp FROM stacks_blocks ORDER BY height`);

      let partialMsg = false;
      let idx = 1;
      while (idx < blocks.length) {
        if (blocks[idx].height - 1 !== blocks[idx - 1].height) {
          if (partialMsg === false) {
            logger.info('Some blocks are not indexed, skipping missing blocks during chain validation');
            partialMsg = true;
          }
          ++idx;
          continue;
        }

        if (blocks[idx].previous_block_hash !== blocks[idx - 1].hash) {
          logger.warn(`Chain divergence detected at block ${blocks[idx - 1].height}`);
          await this.$deleteBlocksFrom(blocks[idx - 1].height);
          await StacksBlocksSummariesRepository.$deleteBlocksFrom(blocks[idx - 1].height);
          return false;
        }
        ++idx;
      }

      logger.debug(`${idx} blocks hash validated in ${new Date().getTime() - start} ms`);
      return true;
    } catch (e) {
      logger.err('Cannot validate chain of block hash. Reason: ' + (e instanceof Error ? e.message : e));
      return true; // Don't do anything if there is a db error
    }
  }
  /**
   * Delete blocks from the database from blockHeight
   */
  public async $deleteBlocksFrom(blockHeight: number) {
    logger.info(`Delete newer blocks from height ${blockHeight} from the database`);

    try {
      await DB.query(`DELETE FROM stacks_blocks where height >= ${blockHeight}`);
    } catch (e) {
      logger.err('Cannot delete indexed blocks. Reason: ' + (e instanceof Error ? e.message : e));
    }
  }
  /**
   * Return most recent block height
   */
  public async $mostRecentBlockHeight(): Promise<number> {
    try {
      const [row] = await DB.query('SELECT MAX(height) as maxHeight from stacks_blocks');
      return row[0]['maxHeight'];
    } catch (e) {
      logger.err(`Cannot count blocks for this pool (using offset). Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }
}

export default new StacksBlockRepository;