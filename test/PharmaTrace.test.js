// Unit tests for contracts/PharmaTrace.sol. Run with:  npx hardhat test
// They cover the rules the whole system relies on: who may do what, the batch life cycle, and the verdict a scan receives.
const { expect } = require('chai');
const { ethers } = require('hardhat');

const V = { NotFound: 0, Authentic: 1, Pending: 2, Flagged: 3, Expired: 4, ManufacturerRevoked: 5, BatchRevoked: 6 };
const HOUR = 3600, DAY = 86400;
const LICENCE = ethers.id('DEMO-MFG-0001');
const REASON = ethers.id('Suspected counterfeit\nPackaging does not match the approved sample.');
const META = ethers.id('batch metadata');

// A revert is checked by the custom error's name, which works with any ethers/Hardhat version.
async function expectRevert(promise, errorName) {
  let failure;
  try { await promise; } catch (e) { failure = e; }
  expect(failure, `expected a revert with ${errorName}`).to.not.equal(undefined);
  expect(String(failure.message) + String(failure.revert?.name ?? '')).to.include(errorName);
}
const now = async () => (await ethers.provider.getBlock('latest')).timestamp;

describe('PharmaTrace contract', () => {
  let pt, admin, regulator, maker, other, stranger;

  beforeEach(async () => {
    [admin, regulator, maker, other, stranger] = await ethers.getSigners();
    pt = await ethers.deployContract('PharmaTrace', [admin.address]);
    await pt.connect(admin).grantRole(await pt.REGULATOR_ROLE(), regulator.address);
    await pt.connect(regulator).registerManufacturer(maker.address, LICENCE);
  });

  const submit = async (signer = maker, batchNo = 'RW-0001', expiresIn = 365 * DAY) => {
    const t = await now();
    await pt.connect(signer).submitBatch(batchNo, META, t - 30 * DAY, t + expiresIn);
    return pt.computeBatchId(signer.address, batchNo);
  };
  const verdict = async (id) => Number((await pt.verifyBatch(id))[0]);

  describe('roles', () => {
    it('makes the deployer the admin and a regulator', async () => {
      expect(await pt.hasRole(await pt.DEFAULT_ADMIN_ROLE(), admin.address)).to.equal(true);
      expect(await pt.hasRole(await pt.REGULATOR_ROLE(), admin.address)).to.equal(true);
    });
    it('lets only a regulator register a manufacturer', async () => {
      await expectRevert(pt.connect(stranger).registerManufacturer(other.address, LICENCE), 'AccessControlUnauthorizedAccount');
    });
    it('refuses to register the same manufacturer twice', async () => {
      await expectRevert(pt.connect(regulator).registerManufacturer(maker.address, LICENCE), 'AlreadyRegistered');
    });
    it('refuses to submit a batch from a wallet that is not a registered manufacturer', async () => {
      const t = await now();
      await expectRevert(pt.connect(stranger).submitBatch('RW-0001', META, t - DAY, t + DAY), 'AccessControlUnauthorizedAccount');
    });
  });

  describe('batch life cycle', () => {
    it('starts a new batch as Pending, and a scan reports it as Pending', async () => {
      const id = await submit();
      expect(await verdict(id)).to.equal(V.Pending);
    });
    it('shows Authentic once the regulator approves', async () => {
      const id = await submit();
      await pt.connect(regulator).approveBatch(id);
      expect(await verdict(id)).to.equal(V.Authentic);
    });
    it('lets only a regulator approve, and only a Pending batch', async () => {
      const id = await submit();
      await expectRevert(pt.connect(stranger).approveBatch(id), 'AccessControlUnauthorizedAccount');
      await pt.connect(regulator).approveBatch(id);
      await expectRevert(pt.connect(regulator).approveBatch(id), 'InvalidBatchState');
    });
    it('rejects a duplicate batch number from the same manufacturer, but not from another one', async () => {
      await submit();
      await expectRevert(submit(maker, 'RW-0001'), 'BatchAlreadyExists');
      await pt.connect(regulator).registerManufacturer(other.address, ethers.id('DEMO-MFG-0002'));
      const idOther = await submit(other, 'RW-0001');
      expect(await verdict(idOther)).to.equal(V.Pending);
    });
    it('rejects an expiry date that is already in the past', async () => {
      const t = await now();
      await expectRevert(pt.connect(maker).submitBatch('RW-0002', META, t - 2 * DAY, t - DAY), 'InvalidInput');
    });
    it('reports a batch it has never heard of as NotFound', async () => {
      expect(await verdict(ethers.id('nothing'))).to.equal(V.NotFound);
    });
  });

  describe('flag, revoke and restore', () => {
    it('flags a batch, then restores Authentic when the flag is resolved', async () => {
      const id = await submit();
      await pt.connect(regulator).approveBatch(id);
      await pt.connect(regulator).flagBatch(id, REASON);
      expect(await verdict(id)).to.equal(V.Flagged);
      await pt.connect(regulator).resolveFlag(id);
      expect(await verdict(id)).to.equal(V.Authentic);
    });
    it('restores Pending, not Authentic, when a never-approved batch is unflagged', async () => {
      const id = await submit();
      await pt.connect(regulator).flagBatch(id, REASON);
      await pt.connect(regulator).resolveFlag(id);
      expect(await verdict(id)).to.equal(V.Pending);
    });
    it('revokes a batch and can reinstate it', async () => {
      const id = await submit();
      await pt.connect(regulator).approveBatch(id);
      await pt.connect(regulator).revokeBatch(id, REASON);
      expect(await verdict(id)).to.equal(V.BatchRevoked);
      await pt.connect(regulator).reinstateBatch(id);
      expect(await verdict(id)).to.equal(V.Authentic);
    });
    it('requires a reason to flag or revoke', async () => {
      const id = await submit();
      await expectRevert(pt.connect(regulator).flagBatch(id, ethers.ZeroHash), 'InvalidInput');
      await expectRevert(pt.connect(regulator).revokeBatch(id, ethers.ZeroHash), 'InvalidInput');
    });
    it('turns every batch of a revoked manufacturer into ManufacturerRevoked', async () => {
      const id = await submit();
      await pt.connect(regulator).approveBatch(id);
      await pt.connect(regulator).revokeManufacturer(maker.address);
      expect(await verdict(id)).to.equal(V.ManufacturerRevoked);
    });
  });

  describe('emergency pause', () => {
    it('blocks new submissions while paused, but regulators can still flag and revoke', async () => {
      const id = await submit();
      await pt.connect(admin).pause();
      await expectRevert(submit(maker, 'RW-0003'), 'EnforcedPause');
      await pt.connect(regulator).flagBatch(id, REASON);
      expect(await verdict(id)).to.equal(V.Flagged);
      await pt.connect(regulator).revokeBatch(id, REASON);
      expect(await verdict(id)).to.equal(V.BatchRevoked);
    });
  });

  describe('expiry', () => {
    it('reports an approved batch as Expired once its expiry date has passed', async () => {
      const id = await submit(maker, 'RW-0004', HOUR);
      await pt.connect(regulator).approveBatch(id);
      expect(await verdict(id)).to.equal(V.Authentic);
      await ethers.provider.send('evm_increaseTime', [2 * HOUR]);
      await ethers.provider.send('evm_mine', []);
      expect(await verdict(id)).to.equal(V.Expired);
    });
  });
});
