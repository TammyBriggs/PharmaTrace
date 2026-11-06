// Run from the repo root.
//   Local:   (with `npx hardhat node` running)  npx hardhat run scripts/deploy.js --network localhost
//   Sepolia: npx hardhat run scripts/deploy.js --network sepolia
// The first account (account #0 locally, the DEPLOYER_PRIVATE_KEY wallet on Sepolia) becomes the admin
// and regulator, so it is the wallet the regulator account in the dashboard must be linked to.
const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const { ethers, artifacts } = hre;
  const [admin] = await ethers.getSigners();

  const contract = await (await ethers.getContractFactory('PharmaTrace')).deploy(admin.address);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const { chainId } = await ethers.provider.getNetwork();

  // The backend and dashboard read these files; nothing is copied by hand.
  // Sepolia goes to its own folder, which is committed so the hosted server can read it.
  const folder = hre.network.name === 'hardhat' || hre.network.name === 'localhost' ? 'chain' : `chain-${hre.network.name}`;
  const out = path.join(__dirname, '..', 'pharmatrace_backend', folder);
  fs.mkdirSync(out, { recursive: true });
  const { abi } = await artifacts.readArtifact('PharmaTrace');
  fs.writeFileSync(path.join(out, 'PharmaTrace.abi.json'), JSON.stringify(abi, null, 2));
  fs.writeFileSync(path.join(out, 'deployment.json'), JSON.stringify(
    { address, chainId: Number(chainId), admin: admin.address, deployedAt: new Date().toISOString() }, null, 2));

  console.log(`PharmaTrace deployed to ${address} (chain ${chainId})`);
  console.log(`Admin/regulator wallet: ${admin.address}`);
  console.log(`Wrote pharmatrace_backend/${folder}/{deployment.json,PharmaTrace.abi.json}`);
  if (Number(chainId) === 11155111) {
    console.log(`View it: https://sepolia.etherscan.io/address/${address}`);
    console.log('Next: commit pharmatrace_backend/chain-sepolia/, and set CHAIN_NETWORK=sepolia and RPC_URL on the server.');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
