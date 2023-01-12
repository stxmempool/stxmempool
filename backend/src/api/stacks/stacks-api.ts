import axios from 'axios';
import {
  Block,
  MempoolTransactionListResponse,
  MempoolTransactionStatsResponse,
  Transaction,
  MempoolTransaction,
  RosettaBlock,
  AddressBalanceResponse,
  AddressTransactionsListResponse,
  RosettaTransaction,
  BlockListResponse,
  TransactionList
} from '@stacks/stacks-blockchain-api-types';
import { StacksTransactionCostsAndFees, CustomTransactionList } from "./stacks-api.interface";
import logger from '../../logger';
import stacksMempool from './stacks-mempool';

class StacksApi {
  protected network_identifier: { blockchain: string, network: string } = {
    blockchain: 'stacks',
    network: 'mainnet'
  };
  constructor () {}

  public async $getTransaction(txId: string): Promise<Transaction | MempoolTransaction> {
    const { data } = await axios.get(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/${txId}`);
    // const { data } = await axios.get(`http://localhost:3999/extended/v1/tx/${txId}`);
    return data;
  }
  // used to grab the tx size
  public async $getTransactionSize(txId: string) {
    const { data } = await axios.get<{ raw_tx: string }>(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/${txId}/raw`);
    // const { data } = await axios.get<{ raw_tx: string }>(`http://localhost:3999/extended/v1/tx/${txId}/raw`);
    return data.raw_tx.length / 2;
  }
  public async $getBlockHeightTip(): Promise<number> {
    const  { data } = await axios.get<BlockListResponse>('https://stacks-node-api.mainnet.stacks.co/extended/v1/block?limit=1');
    // const response = await axios.get('http://localhost:3999/extended/v1/block?limit=1');
    return data.results[0].height;
  }
  public async $getBlockHashByHeight(height: number): Promise<string> {
    const  { data } = await axios.get<Block>(`https://stacks-node-api.mainnet.stacks.co/extended/v1/block/by_height/${height}`);
    // const response = await axios.get('http://localhost:3999/extended/v1/block?limit=1');
    return data.hash;
  }
  public async $getBlockByHeight(height: number): Promise<Block> {
    const  { data } = await axios.get<Block>(`https://stacks-node-api.mainnet.stacks.co/extended/v1/block/by_height/${height}`);
    // const response = await axios.get('http://localhost:3999/extended/v1/block?limit=1');
    return data;
  }
  public async $getNewestBlock() {
    const response = await axios.get('https://stacks-node-api.mainnet.stacks.co/extended/v1/block?limit=1');
    // const response = await axios.get('http://localhost:3999/extended/v1/block?limit=1');

    return response.data.result[0];
  }
  public async $getTransactionFee(transaction) {
    try {
      const { data } = await axios.get(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/${transaction}`);
      // const { data } = await axios.get(`http://localhost:3999/extended/v1/tx/${transaction}`);

      return Number(data.fee_rate);
    } catch (error) {
      console.log('Error in $getTransactionFee in Stacks Api', error);
    }
  }
  public async $getTransactionData(transaction: string) {
      const { data } = await axios.get<Transaction>(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/${transaction}`);
      // const { data } = await axios.get<Transaction>(`http://localhost:3999/extended/v1/tx/${transaction}`);

      return {
        execution_cost_read_count: data.execution_cost_read_count,
        execution_cost_read_length: data.execution_cost_read_length,
        execution_cost_runtime: data.execution_cost_runtime,
        execution_cost_write_count: data.execution_cost_write_count,
        execution_cost_write_length: data.execution_cost_write_length,
        fee_rate: Number(data.fee_rate),
      };
  }
  public async $getTxIdsForBlock(blockHash: string) {
    const { data } = await axios.get<Block>(`https://stacks-node-api.mainnet.stacks.co/extended/v1/block/${blockHash}`);
    // const { data } = await axios.get(`http://localhost:3999/extended/v1/block/${blockHash}`);
    return data.txs;
  }
  // not a STX Api call but it is an important call
  public async $getStacksPrice() {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=blockstack&vs_currencies=usd');
    const price: number = response.data.blockstack.usd;
    return price;
  }

  public async $getCoinbaseTransaction(blockHeight: number, blockHash: string): Promise<string> {
    const network_identifier = this.network_identifier;
    const payload = {
      network_identifier,
      block_identifier: {
        index: blockHeight,
        hash: blockHash,
      }
    };
    let result = '';
    const { data } = await axios.post<{ block: RosettaBlock}>('https://stacks-node-api.mainnet.stacks.co/rosetta/v1/block', payload);
    data.block.transactions.forEach(transaction => {
      if (transaction.operations[0].type === 'coinbase') {
        // return transaction.transaction_identifier.hash;
        result = transaction.transaction_identifier.hash;
      }
    });
    return result;
  }
  public async $getRosettaBlock(blockHeight: number, blockHash: string): Promise<RosettaBlock> {
    const network_identifier = this.network_identifier;
    const payload = {
      network_identifier,
      block_identifier: {
        index: blockHeight,
        hash: blockHash,
      }
    };
    const { data } = await axios.post<{ block: RosettaBlock}>('https://stacks-node-api.mainnet.stacks.co/rosetta/v1/block', payload);
    return data.block;
  }
  public async $getVerboseTransactions(transactionIds: string[]): Promise<CustomTransactionList | undefined> {
    // this is a super janky way of splitting up the query strings. Will refactor for an await Promise.all(pendingPromises) solution
    if (transactionIds.length > 50 && transactionIds.length <= 100) {
      try {
        let query = '';
        for (let i = 0; i < 50; i++) {
          if (i === transactionIds.length - 1) {
            query = query + 'tx_id=' + transactionIds[i];
          } else {
            query = query + 'tx_id=' + transactionIds[i] + '&';
          }
        }
        const { data } = await axios.get<CustomTransactionList>(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/multiple?${query}`);
        query = '';
        for (let i = 50; i < transactionIds.length; i++) {
          if (i === transactionIds.length - 1) {
            query = query + 'tx_id=' + transactionIds[i];
          } else {
            query = query + 'tx_id=' + transactionIds[i] + '&';
          }
        }
        const response = await axios.get<CustomTransactionList>(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/multiple?${query}`);
        return {...data, ...response.data};
      } catch (error) {
        console.log('error in $getVerbose-->', error);
      }
    } else if (transactionIds.length > 100) {
      try {
        let query = '';
        for (let i = 0; i < 50; i++) {
          if (i === transactionIds.length - 1) {
            query = query + 'tx_id=' + transactionIds[i];
          } else {
            query = query + 'tx_id=' + transactionIds[i] + '&';
          }
        }
        const { data } = await axios.get<CustomTransactionList>(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/multiple?${query}`);
        query = '';
        for (let i = 50; i < 100; i++) {
          if (i === transactionIds.length - 1) {
            query = query + 'tx_id=' + transactionIds[i];
          } else {
            query = query + 'tx_id=' + transactionIds[i] + '&';
          }
        }
        const response = await axios.get<CustomTransactionList>(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/multiple?${query}`);
        query = '';
        for (let i = 100; i < transactionIds.length; i++) {
          if (i === transactionIds.length - 1) {
            query = query + 'tx_id=' + transactionIds[i];
          } else {
            query = query + 'tx_id=' + transactionIds[i] + '&';
          }
        }
        const response2 = await axios.get<CustomTransactionList>(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/multiple?${query}`);
        return {...data, ...response.data, ...response2.data};
      } catch (error) {
        console.log('error in $getVerbose-->', error);
      }
    } else {
      try {
        let query = '';
        for (let i = 0; i < transactionIds.length; i++) {
          if (i === transactionIds.length - 1) {
            query = query + 'tx_id=' + transactionIds[i];
          } else {
            query = query + 'tx_id=' + transactionIds[i] + '&';
          }
        }
        const { data } = await axios.get<CustomTransactionList>(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/multiple?${query}`);
        return data;
      } catch (error) {
        console.log('error in $getVerbose-->', error);
      }
    }
  }
  public async $getStacksFees(): Promise<MempoolTransactionStatsResponse> {
    const { data } = await axios.get<MempoolTransactionStatsResponse>('https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/mempool/stats');
    return data;
  }

  public async $getBlockByHash(hash: string): Promise<Block> {
    const { data } = await axios.get<Block>(`https://stacks-node-api.mainnet.stacks.co/extended/v1/block/${hash}`);
    return data;
  }

  public async $getAddress(address: string): Promise<AddressBalanceResponse> {
    const { data } = await axios.get<AddressBalanceResponse>(`https://stacks-node-api.mainnet.stacks.co/extended/v1/address/${address}/balances`);
    return data;
  }

  public async $getAddressTransactions(address: string): Promise<(Transaction | MempoolTransaction)[]> {
    const { data } = await axios.get<AddressTransactionsListResponse>(`https://stacks-node-api.mainnet.stacks.co/extended/v1/address/${address}/transactions`);
    return data.results;
  }
  public async $getAddressPrefix(prefix: string): Promise<string[]> {
    const found: { [address: string]: string } = {};
    const mp = stacksMempool.getMempool();
    for (const tx in mp) {
      if(mp[tx].sender_address.includes(prefix)) {
        found[mp[tx].sender_address] = '';
        if (Object.keys(found).length >= 10) {
          return Object.keys(found);
        }
      } 
    }
    return Object.keys(found);
  }
}

export default new StacksApi();