import axios, { AxiosResponse } from 'axios';
import {
  Block,
  MempoolTransactionStatsResponse,
  Transaction,
  MempoolTransaction,
  RosettaBlock,
  AddressBalanceResponse,
  AddressTransactionsListResponse,
  BlockListResponse,
  CoreNodeFeeResponse
} from '@stacks/stacks-blockchain-api-types';
import { CustomTransactionList } from './stacks-api.interface';
import logger from '../../logger';
import stacksMempool from './stacks-mempool';
import config from '../../config';

class StacksApi {
  protected network_identifier: { blockchain: string, network: string } = {
    blockchain: 'stacks',
    network: 'mainnet'
  };
  protected apiUrl = config.STACKS.DEDICATED_API ? config.STACKS.DEDICATED_API_URL : 'https://api.hiro.so';
  // constructor () {}

  public async $getTransaction(txId: string): Promise<Transaction | MempoolTransaction> {
    const { data } = await axios.get(`${this.apiUrl}/extended/v1/tx/${txId}`);

    return data;
  }

  public async $getTransactionSize(txId: string): Promise<number> {
    const { data } = await axios.get<{ raw_tx: string }>(`${this.apiUrl}/extended/v1/tx/${txId}/raw`);

    return data.raw_tx.length / 2;
  }
  public async $getBlockHeightTip(): Promise<number> {
    const  { data } = await axios.get<BlockListResponse>(`${this.apiUrl}/extended/v1/block?limit=1`);

    return data.results[0].height;
  }
  public async $getBlockHashByHeight(height: number): Promise<string> {
    const  { data } = await axios.get<Block>(`${this.apiUrl}/extended/v1/block/by_height/${height}`);

    return data.hash;
  }
  public async $getBlockByHeight(height: number): Promise<Block> {
    const  { data } = await axios.get<Block>(`${this.apiUrl}/extended/v1/block/by_height/${height}`);

    return data;
  }

  public async $getTxIdsForBlock(blockHash: string): Promise<string[]> {
    const { data } = await axios.get<Block>(`${this.apiUrl}/extended/v1/block/${blockHash}`);

    return data.txs;
  }

  // TODO Create a more effiecient way to store and update current STX value
  public async $getStacksPrice(): Promise<number> {
    const response = await axios.get('https://api.coincap.io/v2/assets/stacks');
    const price: string = response.data.data.priceUsd;
    return Number(price);
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
    const { data } = await axios.post<{ block: RosettaBlock}>(`${this.apiUrl}/rosetta/v1/block`, payload);
    data.block.transactions.forEach(transaction => {
      if (transaction.operations[0].type === 'coinbase') {
        result = transaction.transaction_identifier.hash;
      }
    });
    return result;
  }

  public async $getVerboseTransactions(transactionIds: string[]): Promise<CustomTransactionList | undefined> {
    // A solution to get around public Hiro API rate limiting and query string limits
    // If you have a dedicated API and can change the max length of a query string then you can pass all of the txIds in one call
    const preparedStrings = transactionIds.map(tx => 'tx_id=' + tx + '&');
    const chunkSize  = 50;
    const queryArray: string[][] = [];
    const promiseArray: Promise<AxiosResponse<CustomTransactionList>>[] = [];

    for (let i = 0; i < preparedStrings.length; i += chunkSize) {
      queryArray.push(preparedStrings.slice(i, i + chunkSize));
    }
    try {
      for (let i = 0; i < queryArray.length; i++) {
        const query = queryArray[i].join('');
        promiseArray.push(axios.get(`${this.apiUrl}/extended/v1/tx/multiple?${query}`));
      }
      const result: AxiosResponse<CustomTransactionList>[] = await Promise.all(promiseArray);
      let obj: CustomTransactionList = {};
      for (let i = 0; i < result.length; i++) {
        obj = {...obj, ...result[i].data};
      }
      return obj;
    } catch (e) {
      logger.err(`Cannot fetch all verbose block transactions. Reason: ` + (e instanceof Error ? e.message : e));
    }
  }

  public async $getTransactionFee(txId: string): Promise<number> {
    const { data } = await axios.get<Transaction>(`${this.apiUrl}/extended/v1/tx/${txId}`);
    return Number(data.fee_rate);
  }

  public async $getStacksMempoolTransactions(): Promise<string[]> {
    const response = await axios.post(`${this.apiUrl}/rosetta/v1/mempool`,
    {
      network_identifier: {
        blockchain: 'stacks',
        network: 'mainnet'
    }
    });
    const transactionArray: string[] = response.data.transaction_identifiers.map(({ hash }) => hash);
    return transactionArray;
  }

  // This may be unused for production
  public async $getStacksFees(): Promise<MempoolTransactionStatsResponse> {
    const { data } = await axios.get<MempoolTransactionStatsResponse>('https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/mempool/stats');
    return data;
  }

  public async $getMinFee(): Promise<number> {
    const { data } = await axios.get<CoreNodeFeeResponse>(`${this.apiUrl}/v2/fees/transfer`);
    return Number(data);
  }

  public async $getBlockByHash(hash: string): Promise<Block> {
    const { data } = await axios.get<Block>(`${this.apiUrl}/extended/v1/block/${hash}`);

    return data;
  }

  public async $getAddress(address: string): Promise<AddressBalanceResponse> {
    const { data } = await axios.get<AddressBalanceResponse>(`${this.apiUrl}/extended/v1/address/${address}/balances`);

    return data;
  }

  public async $getAddressTransactions(address: string, offset: string = '0'): Promise<{ total: number, transactions: (Transaction | MempoolTransaction)[]}> {
    const { data } = await axios.get<AddressTransactionsListResponse>(`${this.apiUrl}/extended/v1/address/${address}/transactions?limit=25&offset=${offset}`);

    return {
      total: data.total,
      transactions: data.results,
    };
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