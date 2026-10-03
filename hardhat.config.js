require("@nomicfoundation/hardhat-toolbox");
module.exports = {
  solidity: { version: "0.8.28", settings: { evmVersion: "cancun", optimizer: { enabled: true, runs: 200 } } },
};
