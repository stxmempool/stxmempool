import { BlockExtended } from '../mempool.interfaces';
import { StacksBlockExtended } from '../api/stacks/stacks-api.interface';

export function prepareBlock(block: any): BlockExtended {
  return <BlockExtended>{
    id: block.id ?? block.hash, // hash for indexed block
    timestamp: block.timestamp ?? block.time ?? block.blockTimestamp, // blockTimestamp for indexed block
    height: block.height,
    version: block.version,
    bits: (typeof block.bits === 'string' ? parseInt(block.bits, 16): block.bits),
    nonce: block.nonce,
    difficulty: block.difficulty,
    merkle_root: block.merkle_root ?? block.merkleroot,
    tx_count: block.tx_count ?? block.nTx,
    size: block.size,
    weight: block.weight,
    previousblockhash: block.previousblockhash,
    extras: {
      coinbaseRaw: block.coinbase_raw ?? block.extras?.coinbaseRaw,
      medianFee: block.medianFee ?? block.median_fee ?? block.extras?.medianFee,
      feeRange: block.feeRange ?? block.fee_span,
      reward: block.reward ?? block?.extras?.reward,
      totalFees: block.totalFees ?? block?.fees ?? block?.extras?.totalFees,
      avgFee: block?.extras?.avgFee ?? block.avg_fee,
      avgFeeRate: block?.avgFeeRate ?? block.avg_fee_rate,
      pool: block?.extras?.pool ?? (block?.pool_id ? {
        id: block.pool_id,
        name: block.pool_name,
        slug: block.pool_slug,
      } : undefined),
      usd: block?.extras?.usd ?? block.usd ?? null,
    }
  };
}

// export function prepareStacksBlock(block: any): StacksBlockExtended {
export function prepareStacksBlock(block: any): StacksBlockExtended {
  console.log('block in prepareStacksBlock-->', block.fee_span, 'or-->', block.feeRange);

  return <StacksBlockExtended>{
    id: block.id ?? block.hash, // hash for indexed block
    timestamp: block.timestamp ?? block.time ?? block.blockTimestamp, // blockTimestamp for indexed block
    height: block.height,
    tx_count: block.tx_count ?? block.nTx,
    size: block.size,
    previousblockhash: block.previousblockhash,
    extras: {
      medianFee: block.medianFee ?? block.median_fee ?? block.extras?.medianFee,
      feeRange: block.extras?.feeRange ?? block.fee_span,
      reward: block.reward ?? block?.extras?.reward,
      totalFees: block.totalFees ?? block?.fees ?? block?.extras?.totalFees,
      avgFee: block?.extras?.avgFee ?? block.avg_fee,
      avgFeeRate: block?.avgFeeRate ?? block.avg_fee_rate,
      usd: block?.extras?.usd ?? block.usd ?? null,
    },
    burn_block_hash: block.burn_block_hash,
    minerAddress: block.miner_address,
    execution_cost_read_count: block.execution_cost_read_count,
    execution_cost_read_length: block.execution_cost_read_length,
    execution_cost_runtime: block.execution_cost_runtime,
    execution_cost_write_count: block.execution_cost_write_count,
    execution_cost_write_length: block.execution_cost_write_length,
  };
}
