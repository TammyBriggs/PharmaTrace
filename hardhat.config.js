require("@nomicfoundation/hardhat-toolbox");
try { require("dotenv").config(); } catch { /* dotenv is only needed for Sepolia: run npm install */ }

// Sepolia is only added when both values exist in the .env at the repo root, so local work and the tests are unaffected.
//   SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<key>
//   DEPLOYER_PRIVATE_KEY=<64 hex characters from a wallet used ONLY for testnet>
const networks = {};
const { SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY } = process.env;
if (SEPOLIA_RPC_URL && DEPLOYER_PRIVATE_KEY) {
  networks.sepolia = {
    url: SEPOLIA_RPC_URL,
    chainId: 11155111,
    accounts: [DEPLOYER_PRIVATE_KEY.startsWith("0x") ? DEPLOYER_PRIVATE_KEY : `0x${DEPLOYER_PRIVATE_KEY}`],
  };
}

module.exports = {
  solidity: { version: "0.8.28", settings: { evmVersion: "cancun", optimizer: { enabled: true, runs: 200 } } },
  networks,
};
