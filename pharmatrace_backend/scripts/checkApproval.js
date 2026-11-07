// Read-only: explains why approving a manufacturer from the dashboard would revert.
// Sends no transaction and changes nothing. Run it with the same .env the server uses:
//   node scripts/checkApproval.js <regulatorWallet> <manufacturerWallet>
// <regulatorWallet>   the MetaMask account that is connected on the dashboard
// <manufacturerWallet> the wallet shown on the manufacturer row you are approving
require('dotenv').config();
const { ethers } = require('ethers');
const { getProvider, loadDeployment, assertDeployed } = require('../config/chain');

(async () => {
  const [regulator, manufacturer] = process.argv.slice(2);
  if (!ethers.isAddress(regulator || '') || !ethers.isAddress(manufacturer || '')) {
    console.error('Usage: node scripts/checkApproval.js <regulatorWallet> <manufacturerWallet>');
    process.exit(1);
  }
  await assertDeployed();
  const d = loadDeployment();
  const c = new ethers.Contract(d.address, d.abi, getProvider());
  const [paused, regRole, manRole, isReg, isMan, net] = await Promise.all([
    c.paused(),
    c.REGULATOR_ROLE(),
    c.MANUFACTURER_ROLE(),
    c.hasRole(await c.REGULATOR_ROLE(), regulator),
    c.hasRole(await c.MANUFACTURER_ROLE(), manufacturer),
    getProvider().getNetwork(),
  ]);
  console.log(`Contract            ${d.address} (chain ${net.chainId})`);
  console.log(`Paused              ${paused}${paused ? '   <- EnforcedPause: unpause it first' : ''}`);
  console.log(`Regulator role      ${regulator}: ${isReg}${isReg ? '' : '   <- AccessControlUnauthorizedAccount: connect the deployer/regulator wallet'}`);
  console.log(`Already registered  ${manufacturer}: ${isMan}${isMan ? '   <- AlreadyRegistered: approved on-chain already, only the database row is behind' : ''}`);
  const ok = !paused && isReg && !isMan;
  console.log(ok ? '\nNothing on-chain should block this approval.' : '\nAt least one condition above will make registerManufacturer revert.');
})().catch((e) => { console.error(e.shortMessage || e.message); process.exit(1); });
