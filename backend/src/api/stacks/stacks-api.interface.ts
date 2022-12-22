import { Block, Transaction, MempoolTransaction, TransactionFound } from '@stacks/stacks-blockchain-api-types';

export interface BlockExtension {
  totalFees?: number;
  medianFee?: number;
  feeRange?: number[];
  avgFee?: number;
  avgFeeRate?: number;
  usd?: number | null;
  reward: number;
}
export interface ExtendedStacksBlock extends Block {
  extras: BlockExtension;
  tx_count: number;
  id: string;
  timestamp: number;
  previousblockhash: string;
  size?: number;
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
// export type ExtendedStacksTransaction = MempoolTransaction | Transaction & {
//   firstSeen?: number;
//   vsize?: number;
//   feePerVsize?: number;
//   effectiveFeePerVsize?: number;
//   deleteAfter?: number;
// }
type Midpoint = MempoolTransaction | Transaction
export type ExtendedStacksTransaction = Midpoint & {
  feeRateAsNumber: number;
  firstSeen?: number;
  vsize: number;
  feePerVsize: number;
  effectiveFeePerVsize: number;
  deleteAfter?: number;
}
