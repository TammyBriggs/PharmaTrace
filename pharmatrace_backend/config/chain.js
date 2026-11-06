const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

// Written by scripts/deploy.js in the repo root.
//   local Hardhat chain  -> pharmatrace_backend/chain/          (not committed; changes on every restart)
//   Sepolia testnet      -> pharmatrace_backend/chain-sepolia/  (committed, so the hosted server can read it)
// Set CHAIN_NETWORK=sepolia to use the second one. Leave it unset for the local chain.
const NETWORK = (process.env.CHAIN_NETWORK || '').trim().toLowerCase();
if (NETWORK && !/^[a-z0-9-]+$/.test(NETWORK)) throw new Error('CHAIN_NETWORK may only contain letters, digits and dashes.');
const DIR = path.join(__dirname, '..', NETWORK && NETWORK !== 'localhost' ? `chain-${NETWORK}` : 'chain');
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';

// What the browser is told to use if MetaMask does not know the network yet. RPC_URL itself often
// contains a private API key (Alchemy, Infura), so it is never sent to the browser.
const PUBLIC_RPCS = { 11155111: 'https://ethereum-sepolia-rpc.publicnode.com' };
const CHAIN_NAMES = { 31337: 'Hardhat Local', 11155111: 'Sepolia' };
const publicRpcFor = (chainId) => process.env.PUBLIC_RPC_URL || PUBLIC_RPCS[chainId] || (NETWORK ? null : RPC_URL);
const chainNameFor = (chainId) => CHAIN_NAMES[chainId] || `Chain ${chainId}`;

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

/**
 * A transaction the browser just confirmed can take a moment to show up on this server's node
 * (the wallet and the server may use different providers). Poll briefly before giving up.
 */
async function waitForReceipt(txHash, timeoutMs = 20000) {
  const started = Date.now();
  for (;;) {
    const receipt = await getProvider().getTransactionReceipt(txHash);
    if (receipt || Date.now() - started >= timeoutMs) return receipt;
    await new Promise((r) => setTimeout(r, 1500));
  }
}

const EXPLORERS = { 11155111: 'https://sepolia.etherscan.io' };

/**
 * Base address of the block explorer for the deployed network, or null on a local chain (which has none).
 * EXPLORER_URL overrides it. Read once per request, not once per transaction.
 */
function explorerBase() {
  const set = (process.env.EXPLORER_URL || '').trim().replace(/\/$/, '');
  if (set) return set;
  try { return EXPLORERS[loadDeployment().chainId] ?? null; } catch { return null; }
}

module.exports = { getProvider, loadDeployment, assertDeployed, waitForReceipt, publicRpcFor, chainNameFor, explorerBase };
