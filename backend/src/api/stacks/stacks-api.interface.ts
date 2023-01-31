import { Block, Transaction, MempoolTransaction, TransactionFound } from '@stacks/stacks-blockchain-api-types';
import { IBackendInfo, IConversionRates, IDifficultyAdjustment, ILoadingIndicators } from '../../mempool.interfaces';

export interface BlockExtension {
  totalFees?: number;
  medianFee?: number;
  feeRange?: number[];
  avgFee?: number;
  avgFeeRate?: number;
  usd?: number | null;
  reward: number;
}
export interface StacksBlockExtended extends Block {
  extras: BlockExtension;
  tx_count: number;
  id: string;
  timestamp: number;
  previousblockhash: string;
  size?: number;
  minerAddress: string;
}
export interface StacksTransactionCostsAndFees {
  fee_rate: number;
  execution_cost_read_count: number;
  execution_cost_read_length: number;
  execution_cost_runtime: number;
  execution_cost_write_count: number;
  execution_cost_write_length: number;
}
export interface StacksTransactionDataWithSize {
  fee_rate: number;
  size: number;
  execution_cost_read_count: number;
  execution_cost_read_length: number;
  execution_cost_runtime: number;
  execution_cost_write_count: number;
  execution_cost_write_length: number;
}
export interface StacksMempoolBlock {
  blockSize: number;
  blockVSize: number;
  nTx: number;
  medianFee: number;
  totalFees: number;
  feeRange: number[];
}
export interface StacksMempoolBlockWithTransactions extends StacksMempoolBlock {
  transactionIds: string[];
  transactions: StacksTransactionStripped[];
}
export interface StacksTransactionStripped {
  txid: string;
  fee: number;
  vsize: number;
  type: 'token_transfer' | 'smart_contract' | 'contract_call' | 'poison_microblock' | 'coinbase';
  execution_cost_read_count: number | undefined;
}
export interface StacksBlockSummary {
  id: string;
  transactions: StacksTransactionStripped[];
}
export interface StacksMempoolBlockDelta {
  added: StacksTransactionStripped[];
  removed: string[];
}
export interface CustomTransactionList {
  [k: string]: TransactionFound;
}
type Midpoint = MempoolTransaction | Transaction

export type StacksTransactionExtended = Midpoint & {
  feeRateAsNumber: number;
  firstSeen?: number | null;
  vsize: number;
  feePerVsize: number;
  effectiveFeePerVsize: number;
  deleteAfter?: number;
  execution_cost_read_count?: number;
  status?: Status;
}
export interface Status {
  confirmed: boolean;
  block_height?: number;
  block_hash?: string;
  block_time?: number;
}

export type ProjectedMempoolBlockDetails = {
  Miner: string;
  // block_hash: string;
  // height: number;
  tx_count: number;
  // parent_stacks_block_hash: string;
  // parent_stacks_microblock: string;
  // parent_stacks_microblock_seq: number;
  block_size: number;
  execution_consumed: { 
    runtime: number; 
    write_len: number; 
    write_cnt: number; 
    read_len: number; 
    read_cnt: number;
  };
  percentage: number;
  tx_fees_microstacks: number;
}
export interface RawProjectedMempoolBlock {
  tx_ids: string[];
  blockDetails?: ProjectedMempoolBlockDetails;
}
export interface ProjectedMempoolBlock {
  tx_ids: StacksTransactionExtended[];
  blockDetails: ProjectedMempoolBlockDetails;
  transactions: StacksTransactionStripped[];
}
export interface GetStacksInitData {
  mempoolInfo: MempoolInfo;
  vBytesPerSecond: number;
  blocks: StacksBlockExtended[];
  conversions: IConversionRates;
  'mempool-blocks': StacksMempoolBlock[];
  transactions: StacksTransactionStripped[];
  backendInfo: IBackendInfo;
  loadingIndicators: ILoadingIndicators;
  da: IDifficultyAdjustment | null;
  fees: {
    fastestFee: number;
    halfHourFee: number;
    hourFee: number;
    economyFee: number;
    minimumFee: number;
  }
}
export type MempoolInfo = {
  loaded: boolean;
  size: number;
  bytes: number;
  usage: number;
  total_fee: number;
  maxmempool: number;
  mempoolminfee: number;
  minrelaytxfee: number;
}