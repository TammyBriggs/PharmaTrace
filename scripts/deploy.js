// Run from the repo root, with `npx hardhat node` running in another terminal:
//   npx hardhat run scripts/deploy.js --network localhost
// Account #0 becomes the admin and regulator (your "Super Admin (demo)" wallet).
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
  const out = path.join(__dirname, '..', 'pharmatrace_backend', 'chain');
  fs.mkdirSync(out, { recursive: true });
  const { abi } = await artifacts.readArtifact('PharmaTrace');
  fs.writeFileSync(path.join(out, 'PharmaTrace.abi.json'), JSON.stringify(abi, null, 2));
  fs.writeFileSync(path.join(out, 'deployment.json'), JSON.stringify(
    { address, chainId: Number(chainId), admin: admin.address, deployedAt: new Date().toISOString() }, null, 2));

  console.log(`PharmaTrace deployed to ${address} (chain ${chainId})`);
  console.log(`Admin/regulator wallet: ${admin.address}`);
  console.log('Wrote pharmatrace_backend/chain/{deployment.json,PharmaTrace.abi.json}');
}

main().catch((e) => { console.error(e); process.exit(1); });
