const { AbiCoder, concat, keccak256 } = require('ethers');

// Merkle tree over the pack serials of ONE batch. It must match what the contract checks:
//   leaf  = keccak256(abi.encode(batchId, serial))            (PharmaTrace.packLeaf)
//   node  = keccak256(smaller child, larger child)             (OpenZeppelin MerkleProof, so no left/right flags are needed)
// Leaves are sorted, so the same serials always give the same root whatever order they were created in.
// A level with an odd number of nodes carries its last node up unchanged; the proof simply skips that level.
const coder = AbiCoder.defaultAbiCoder();

const leafOf = (batchId, serial) => keccak256(coder.encode(['bytes32', 'string'], [batchId, serial]));
const hashPair = (a, b) => keccak256(a.toLowerCase() < b.toLowerCase() ? concat([a, b]) : concat([b, a]));

function buildTree(batchId, serials) {
  const leaves = [...new Set(serials.map((s) => leafOf(batchId, s)))].sort();
  if (leaves.length === 0) throw new Error('A batch needs at least one serial to build a tree.');
  const levels = [leaves];
  while (levels[levels.length - 1].length > 1) {
    const prev = levels[levels.length - 1], next = [];
    for (let i = 0; i < prev.length; i += 2) next.push(i + 1 < prev.length ? hashPair(prev[i], prev[i + 1]) : prev[i]);
    levels.push(next);
  }
  const index = new Map(leaves.map((l, i) => [l, i]));
  return {
    root: levels[levels.length - 1][0],
    count: leaves.length,
    /** Sibling hashes from this serial's leaf up to the root, or null when the serial is not in the tree. */
    proofFor(serial) {
      let i = index.get(leafOf(batchId, serial));
      if (i === undefined) return null;
      const proof = [];
      for (let l = 0; l < levels.length - 1; l++) {
        const sibling = levels[l][i ^ 1];
        if (sibling !== undefined) proof.push(sibling);
        i >>= 1;
      }
      return proof;
    },
  };
}

/** Recomputes a root from a leaf and its proof (same rule as the contract), to check a proof without the chain. */
function rootFromProof(leaf, proof) {
  return proof.reduce((acc, sibling) => hashPair(acc, sibling), leaf);
}

module.exports = { leafOf, buildTree, rootFromProof };
