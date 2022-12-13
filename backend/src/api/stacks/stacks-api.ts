import axios from "axios";
import { Block, MempoolTransactionListResponse, Transaction, MempoolTransaction } from '@stacks/stacks-blockchain-api-types';
import { StacksTransactionCostsAndFees } from "./stacks-api.interface";

class StacksApi {
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
  public async $getBlockTip(): Promise<number> {
    const response = await axios.get('https://stacks-node-api.mainnet.stacks.co/extended/v1/block?limit=1');
    // const response = await axios.get('http://localhost:3999/extended/v1/block?limit=1');

    return response.data.results[0].height;
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
  // not a STX Api call but it is an important call
  public async $getStacksPrice() {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=blockstack&vs_currencies=usd');
    const price: number = response.data.blockstack.usd;
    return price;
  }
}

export default new StacksApi();