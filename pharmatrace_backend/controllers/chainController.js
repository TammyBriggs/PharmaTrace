const { assertDeployed, publicRpcFor, chainNameFor } = require('../config/chain');

// Everything the browser needs to talk to the contract through MetaMask.
const getChainConfig = async (req, res) => {
  try {
    const d = await assertDeployed();
    res.status(200).json({
      address: d.address, chainId: d.chainId, chainName: chainNameFor(d.chainId),
      rpcUrl: publicRpcFor(d.chainId), abi: d.abi,
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
};

module.exports = { getChainConfig };
