// scripts/simulate.js  ->  npx hardhat run scripts/simulate.js
// Deploys PharmaTrace on a local chain, replays ~4 weeks of realistic activity as REAL
// transactions, then exports everything to viz/chain-data.js for the visualisation page.
const { ethers } = require("hardhat");
const fs = require("fs");

const DAY = 86400;
const DRUGS = [
  { name: "Artemether/Lumefantrine 20/120mg", cat: "Antimalarial" },
  { name: "Amoxicillin 500mg", cat: "Antibiotic" },
  { name: "Tenofovir/Lamivudine/Dolutegravir", cat: "ARV" },
];
const VERDICTS = ["NotFound", "Authentic", "Pending", "Flagged", "Expired", "ManufacturerRevoked"];

// Owner of each of the 35 batches: 0 Medilab, 1 AfriCare, 2 Umurage, 3 Unlicensed (revoked later), 4 Super Admin (demo)
const OWNER = [0,1,0,2,1,0,3,1,4,0,2,1,0,3,1,4,0,1,2,0,1,4,0,3,1,0,2,1,4,0,1,2,0,1,4];
const FLAG = [3, 10, 16, 20, 26]; // the 5 batches that end up Flagged (26 is flagged while still Pending)
const FALSE_ALARM = 17;           // flagged, then cleared with resolveFlag
const PENDING = [31, 32, 33, 34]; // submitted but never approved
const SHORT_EXPIRY = [1, 5];      // expire 10 days after submission -> Expired verdict

async function main() {
  const [admin, m0, m1, m2, m3] = await ethers.getSigners();
  const c = await (await ethers.getContractFactory("PharmaTrace")).deploy(admin.address);
  await c.waitForDeployment();

  const owners = [
    { label: "Medilab Africa Ltd", signer: m0 },
    { label: "AfriCare Pharma", signer: m1 },
    { label: "Umurage Pharma Ltd", signer: m2 },
    { label: "Unlicensed Supplier", signer: m3 },
    { label: "Super Admin (demo)", signer: admin }, // regulator AND manufacturer, for one-account demos
  ];

  const log = [];
  async function send(type, signer, method, args, meta = {}) {
    const tx = await c.connect(signer)[method](...args);
    const r = await tx.wait();
    const blk = await ethers.provider.getBlock(r.blockNumber);
    log.push({ hash: tx.hash, block: r.blockNumber, timestamp: blk.timestamp, type,
               from: signer.address, gasUsed: Number(r.gasUsed), ...meta });
  }

  // Day 0: the regulator registers every manufacturer (including itself, for demo convenience)
  for (const o of owners) {
    await send("registerManufacturer", admin, "registerManufacturer",
      [o.signer.address, ethers.id("LICENCE-" + o.label)], { manufacturer: o.label });
  }

  const batches = OWNER.map((o, i) => {
    const drug = DRUGS[i % 3];
    const no = `RW-2026-${String(401 + i).padStart(4, "0")}`;
    const id = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder()
      .encode(["address", "string"], [owners[o].signer.address, no]));
    return { i, no, id, drug: drug.name, category: drug.cat, manufacturer: owners[o].label,
             day: Math.floor((i * 22) / 35) };
  });

  // Build the schedule (day -> action), then execute it in time order
  const acts = [];
  const add = (day, type, signer, method, args, meta) => acts.push({ day, type, signer, method, args, meta });
  for (const b of batches) {
    const o = owners[OWNER[b.i]];
    const life = SHORT_EXPIRY.includes(b.i) ? 10 * DAY : 730 * DAY;
    const m = { batchNo: b.no, batchId: b.id, category: b.category, manufacturer: b.manufacturer };
    add(b.day, "submitBatch", o.signer, "submitBatch",
      (t) => [b.no, ethers.id(`${b.no}|${b.drug}`), t - 30 * DAY, t + life], m);
    if (PENDING.includes(b.i)) continue;
    if (b.i === 26) { // caught before approval
      add(b.day + 1, "flagBatch", admin, "flagBatch", () => [b.id, ethers.id("packaging mismatch")], m);
      continue;
    }
    const ap = b.day + 1 + (b.i % 3);
    add(ap, "approveBatch", admin, "approveBatch", () => [b.id], m);
    if (FLAG.includes(b.i))
      add(ap + 3 + (b.i % 4), "flagBatch", admin, "flagBatch", () => [b.id, ethers.id("lab test failed")], m);
    if (b.i === FALSE_ALARM) {
      add(ap + 2, "flagBatch", admin, "flagBatch", () => [b.id, ethers.id("suspected fake label")], m);
      add(ap + 3, "resolveFlag", admin, "resolveFlag", () => [b.id], m);
    }
  }
  add(27, "revokeManufacturer", admin, "revokeManufacturer",
    () => [m3.address], { manufacturer: owners[3].label });

  acts.sort((a, b) => a.day - b.day); // stable: keeps submit before approve on the same day
  const start = (await ethers.provider.getBlock("latest")).timestamp + DAY;
  const perDay = {};
  for (const a of acts) {
    const k = (perDay[a.day] = (perDay[a.day] ?? -1) + 1);
    const t = start + a.day * DAY + 9 * 3600 + k * 900; // strictly increasing block times
    await ethers.provider.send("evm_setNextBlockTimestamp", [t]);
    await send(a.type, a.signer, a.method, a.args(t), a.meta);
  }

  // Final state straight from the contract: exactly what a QR scan would return
  for (const b of batches) b.verdict = VERDICTS[Number((await c.verifyBatch(b.id))[0])];

  const out = {
    contract: await c.getAddress(),
    manufacturers: owners.map((o) => ({ label: o.label, address: o.signer.address })),
    batches, txs: log,
  };
  fs.mkdirSync("viz", { recursive: true });
  fs.writeFileSync("viz/chain-data.js", "window.CHAIN_DATA = " + JSON.stringify(out, null, 1) + ";");

  const tally = {};
  batches.forEach((b) => (tally[b.verdict] = (tally[b.verdict] || 0) + 1));
  console.log(`${log.length} transactions, ${batches.length} batches`);
  console.table(tally);
  console.log("Open viz/index.html in your browser.");
}

main().catch((e) => { console.error(e); process.exit(1); });
