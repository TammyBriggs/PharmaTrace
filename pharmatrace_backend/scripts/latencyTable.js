#!/usr/bin/env node
// Prints saved latency results (the latency-*.json files written by latencyTest.js) as a readable table,
// so a run can be screenshotted for the report without running it again.
//
//   node scripts/latencyTable.js ../docs/latency-results/*.json
//   node scripts/latencyTable.js ../docs/latency-results/latency-frankfurt-chain-on-*.json
const fs = require('fs');
const path = require('path');

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node scripts/latencyTable.js <latency-*.json> [more files...]');
  process.exit(1);
}

const pad = (v, n, right) => (right ? String(v).padStart(n) : String(v).padEnd(n));

for (const f of files) {
  let d;
  try { d = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.error(`Cannot read ${f}: ${e.message}`); continue; }
  const cols = [
    ['Test', (r) => r.name, false],
    ['First (ms)', (r) => r.firstMs, true],
    ['Median', (r) => r.medianMs ?? '-', true],
    ['p95', (r) => r.p95Ms ?? '-', true],
    ['Slowest', (r) => r.maxMs ?? '-', true],
    ['OK', (r) => r.ok, true],
    ['429', (r) => r.rateLimited, true],
    ['Failed', (r) => r.failed, true],
  ];
  const widths = cols.map(([h, get]) => Math.max(h.length, ...d.results.map((r) => String(get(r)).length)));
  const line = '+' + widths.map((w) => '-'.repeat(w + 2)).join('+') + '+';
  const row = (cells) => '| ' + cells.map((c, i) => pad(c, widths[i], cols[i][2])).join(' | ') + ' |';

  console.log(`\nRun "${d.label}"  |  ${path.basename(f)}`);
  console.log(`Backend: ${d.api}   Server mode: ${d.mode}`);
  console.log(`Started: ${d.startedAt}   Timed requests per test: ${d.runsPerTest} after the first, ${d.gapMs} ms apart${d.idleMinutes ? `, ${d.idleMinutes} min idle before` : ''}`);
  console.log(line);
  console.log(row(cols.map((c) => c[0])));
  console.log(line);
  for (const r of d.results) console.log(row(cols.map((c) => c[1](r))));
  console.log(line);
  console.log('Times in milliseconds, measured from the machine that ran the test.');
}
