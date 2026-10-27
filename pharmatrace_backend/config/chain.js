const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

// Written by scripts/deploy.js in the repo root (npx hardhat run scripts/deploy.js --network localhost).
const DIR = path.join(__dirname, '..', 'chain');
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';

let provider;
const getProvider = () => (provider ??= new ethers.JsonRpcProvider(RPC_URL, undefined, { cacheTimeout: -1 }));

/** Reads the deployment fresh each time, so a redeploy needs no backend restart. */
function loadDeployment() {
  try {
    const abi = JSON.parse(fs.readFileSync(path.join(DIR, 'PharmaTrace.abi.json'), 'utf8'));
    const deployment = JSON.parse(fs.readFileSync(path.join(DIR, 'deployment.json'), 'utf8'));
    return { abi, ...deployment, rpcUrl: RPC_URL, iface: new ethers.Interface(abi) };
  } catch {
    const e = new Error('The contract has not been deployed yet. Run the deploy script first.');
    e.status = 503;
    throw e;
  }
}

/** Throws a 503 if the node is down or was restarted (a fresh chain has no contract at the old address). */
async function assertDeployed() {
  const d = loadDeployment();
  let code;
  try { code = await getProvider().getCode(d.address); }
  catch {
    const e = new Error(`Cannot reach the blockchain node at ${RPC_URL}. Is "npx hardhat node" running?`);
    e.status = 503; throw e;
  }
  if (code === '0x') {
    const e = new Error('The contract is not on this chain. The node was probably restarted: redeploy it.');
    e.status = 503; throw e;
  }
  return d;
}

module.exports = { getProvider, loadDeployment, assertDeployed };
