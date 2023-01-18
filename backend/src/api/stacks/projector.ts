import { execFile } from 'child_process';
import util from 'util';
import DB from '../../database';



const runProjection = async () => {
  const exec = util.promisify(execFile);
  const { stdout, stderr } = await exec('/Users/walterdevault/Stacks/stacks-blockchain/target/debug/stacks-inspect', ['try-mine', '/Users/walterdevault/Stacks/stacks-blockchain/testnet/stacks-node/mainnet/', '10', '30000']);
};

const saveProjection = async (projectedBlock) => {
  try {
    const query = `INSERT INTO projections(
      blockTimestamp,            size,                       tx_count,                   fees,                
      fee_span,                  median_fee,                 reward,                     avg_fee,        
      avg_fee_rate               transactions,               execution_cost_read_count   execution_cost_read_length
      execution_cost_runtime     execution_cost_write_count  execution_cost_write_length
    ) VALUE (
      ?, ?, FROM_UNIXTIME(?), ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )`;
    const params: any[] = [];
    await DB.query(query, params);

  } catch (error) {
    
  }
}