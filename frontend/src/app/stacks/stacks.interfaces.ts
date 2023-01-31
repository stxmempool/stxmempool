import { Block, Transaction, MempoolTransaction, TransactionFound } from '@stacks/stacks-blockchain-api-types';
import { DifficultyAdjustment } from '../interfaces/node-api.interface';
import { IBackendInfo, MempoolInfo, Recommendedfees } from '../interfaces/websocket.interface';
import { ILoadingIndicators } from '../services/state.service';

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

export interface StacksMempoolBlock {
  blockSize: number;
  blockVSize: number;
  nTx: number;
  medianFee: number;
  totalFees: number;
  feeRange: number[];
}
export interface StacksTransactionStripped {
  txid: string;
  fee: number;
  vsize: number;
  type: 'token_transfer' | 'smart_contract' | 'contract_call' | 'poison_microblock' | 'coinbase';
  execution_cost_read_count: number | undefined;
}
export interface StacksMempoolBlockWithTransactions extends StacksMempoolBlock {
  transactionIds: string[];
  transactions: StacksTransactionStripped[];
}
export interface StacksBlockSummary {
  id: string;
  transactions: StacksTransactionStripped[];
}
type Midpoint = MempoolTransaction | Transaction
export type StacksTransactionExtended = Midpoint & {
  feeRateAsNumber: number;
  firstSeen?: number;
  vsize: number;
  feePerVsize: number;
  effectiveFeePerVsize: number;
  deleteAfter?: number;
}
export type MinedStacksTransactionExtended = Transaction & {
  token_transfer?: {
    recipient_address: string;
    /**
     * Transfer amount as Integer string (64-bit unsigned integer)
     */
    amount: string;
    /**
     * Hex encoded arbitrary message, up to 34 bytes length (should try decoding to an ASCII string)
     */
    memo: string;
  };
  contract_call?: {
    /**
     * Contract identifier formatted as `<principaladdress>.<contract_name>`
     */
    contract_id: string;
    /**
     * Name of the Clarity function to be invoked
     */
    function_name: string;
    /**
     * Function definition, including function name and type as well as parameter names and types
     */
    function_signature: string;
    /**
     * List of arguments used to invoke the function
     */
    function_args?: {
      hex: string;
      repr: string;
      name: string;
      type: string;
    }[];
  };
  poison_microblock?: {
    /**
     * Hex encoded microblock header
     */
    microblock_header_1: string;
    /**
     * Hex encoded microblock header
     */
    microblock_header_2: string;
  };
  feeRateAsNumber: number;
  firstSeen?: number;
  vsize: number;
  feePerVsize: number;
  effectiveFeePerVsize: number;
  deleteAfter?: number;
}

export interface StacksMempoolBlockDelta {
  added: StacksTransactionStripped[],
  removed: string[];
}

export interface StacksWebsocketResponse {
  block?: StacksBlockExtended;
  blocks?: StacksBlockExtended[];
  conversions?: any;
  txConfirmed?: boolean;
  historicalDate?: string;
  mempoolInfo?: MempoolInfo;
  vBytesPerSecond?: number;
  previousRetarget?: number;
  action?: string;
  data?: string[];
  tx?: Transaction;
  transactions?: StacksTransactionStripped[];
  loadingIndicators?: ILoadingIndicators;
  backendInfo?: IBackendInfo;
  da?: DifficultyAdjustment;
  fees?: Recommendedfees;
  'track-tx'?: string;
  'track-address'?: string;
  'track-asset'?: string;
  'track-mempool-block'?: number;
  'watch-mempool'?: boolean;
  'track-bisq-market'?: string;
}