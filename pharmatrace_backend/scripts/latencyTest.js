#!/usr/bin/env node
// Latency test for the hosted system. Times real HTTPS requests from where you run it (your laptop, so the
// numbers include your own internet connection), one at a time, and prints a table you can paste into the report.
//
//   node scripts/latencyTest.js --api https://pharmatrace-bf19.onrender.com \
//        --gtin <GTIN> --batch <BATCH NO> --serial <PACK SERIAL> \
//        --web https://pharma-trace-gamma.vercel.app --label chain-on
//
// Options
//   --api     backend address (or API_URL)                             required
//   --batch   a batch number that exists on that server                required
//   --gtin    the batch's GTIN                                         recommended (history needs it)
//   --serial  one pack serial from that batch                          optional (adds the pack scan)
//   --web     dashboard address on Vercel                              optional (adds page load and the /api hop)
//   --runs    timed requests after the first one, per test (default 20)
//   --gap     milliseconds between requests (default 1200, keeps under the 60 scans per minute limit)
//   --idle    minutes to wait before the first request (use 16 for a cold start of a sleeping Render server)
//   --label   a name for this run, used in the output file (default "run")
//
// The server's CHAIN_READS setting cannot be changed from here. Run once, change it on Render, wait for the
// redeploy, and run again with another --label. The script reads the "source" field of each scan reply, so it
// reports for itself which mode the server was in ("database" = chain reads off, "blockchain + database" = on).
//
// NOTE: every scan is logged by the server like a real scan, so a run adds scans to the analytics. The script
// prints a SQL statement at the end that removes exactly those scans.
const fs = require('fs');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
  return acc;
}, []));
const API = String(args.api || process.env.API_URL || '').replace(/\/$/, '');
const WEB = args.web ? String(args.web).replace(/\/$/, '') : null;
const RUNS = Math.max(1, parseInt(args.runs, 10) || 20);
const GAP = Math.max(0, args.gap === undefined ? 1200 : parseInt(args.gap, 10) || 0);
const IDLE = parseFloat(args.idle) || 0;
const LABEL = String(args.label || 'run').replace(/[^a-z0-9_-]/gi, '-');
const { gtin, batch, serial } = args;

if (!API || !batch) {
  console.error('Usage: node scripts/latencyTest.js --api <backend url> --batch <batch no> [--gtin <gtin>] [--serial <serial>] [--web <dashboard url>] [--runs 20] [--gap 1200] [--idle 16] [--label chain-on]');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const qs = (o) => new URLSearchParams(Object.fromEntries(Object.entries(o).filter(([, v]) => v))).toString();
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

async function timed(url) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'PharmaTrace-latency-test' }, signal: AbortSignal.timeout(90_000) });
    const text = await res.text();                       // include the time to download the whole body
    const ms = performance.now() - t0;
    let source = null;
    try { source = JSON.parse(text).source ?? null; } catch { /* not JSON (a web page) */ }
    return { ms, status: res.status, source };
  } catch (e) {
    return { ms: performance.now() - t0, status: 0, source: null, error: e.name === 'TimeoutError' ? 'timeout' : e.message };
  }
}

async function measure(name, url) {
  process.stdout.write(`  ${name.padEnd(34)}`);
  const first = await timed(url);
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    await sleep(GAP);
    runs.push(await timed(url));
    if (i % 5 === 4) process.stdout.write('.');
  }
  const good = runs.filter((r) => r.status >= 200 && r.status < 300).map((r) => r.ms).sort((a, b) => a - b);
  const limited = runs.filter((r) => r.status === 429).length;
  const failed = runs.filter((r) => r.status !== 429 && !(r.status >= 200 && r.status < 300)).length;   // timeouts, 4xx and 5xx
  const sources = [...new Set([first, ...runs].map((r) => r.source).filter(Boolean))];
  const out = {
    name, url, firstMs: Math.round(first.ms), firstStatus: first.status, ok: good.length, rateLimited: limited, failed, sources,
    ...(good.length ? {
      minMs: Math.round(good[0]), medianMs: Math.round(pct(good, 50)),
      meanMs: Math.round(good.reduce((a, b) => a + b, 0) / good.length),
      p95Ms: Math.round(pct(good, 95)), maxMs: Math.round(good[good.length - 1]),
    } : {}),
  };
  console.log(` first ${out.firstMs} ms, median ${out.medianMs ?? '-'} ms${limited ? `, ${limited} rate-limited` : ''}${failed ? `, ${failed} failed` : ''}`);
  return out;
}

(async () => {
  if (IDLE > 0) {
    console.log(`Waiting ${IDLE} minutes so the server goes to sleep before the first request...`);
    await sleep(IDLE * 60_000);
  }
  const startedAt = new Date();
  console.log(`\nLatency test "${LABEL}" against ${API}  (${RUNS} timed requests per test after the first, ${GAP} ms apart)\n`);

  const tests = [['Health check (no database)', `${API}/api/health`]];
  tests.push([`Scan batch ${batch}`, `${API}/api/verify?${qs({ gtin, batch })}`]);
  if (serial) tests.push([`Scan pack ${serial}`, `${API}/api/verify?${qs({ gtin, batch, serial })}`]);
  if (gtin) tests.push(['Batch history', `${API}/api/verify/history?${qs({ gtin, batch })}`]);
  if (WEB) {
    tests.push(['Dashboard page (Vercel, static)', `${WEB}/`]);
    tests.push(['Scan through Vercel /api forward', `${WEB}/api/verify?${qs({ gtin, batch })}`]);
  }

  const results = [];
  for (const [name, url] of tests) results.push(await measure(name, url));
  const finishedAt = new Date();

  const scanSources = [...new Set(results.filter((r) => /^Scan/.test(r.name)).flatMap((r) => r.sources))];
  const mode = scanSources.includes('blockchain + database') ? 'chain reads ON' : scanSources.includes('database') ? 'chain reads OFF' : 'unknown';

  console.log(`\nServer mode seen in the scan replies: ${mode}  (${scanSources.join(', ') || 'no source field'})`);
  console.log('\n| Test | First request (ms) | Median (ms) | 95th percentile (ms) | Slowest (ms) | OK | Rate-limited | Failed |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const r of results) {
    console.log(`| ${r.name} | ${r.firstMs} | ${r.medianMs ?? '-'} | ${r.p95Ms ?? '-'} | ${r.maxMs ?? '-'} | ${r.ok} | ${r.rateLimited} | ${r.failed} |`);
  }

  const file = `latency-${LABEL}-${startedAt.toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(file, JSON.stringify({ label: LABEL, mode, api: API, web: WEB, runsPerTest: RUNS, gapMs: GAP, idleMinutes: IDLE, startedAt, finishedAt, results }, null, 2));
  console.log(`\nSaved ${file}`);

  // The scan tests added rows to scan_events. They have no signed-in user, so they can be told apart by time.
  const from = new Date(startedAt.getTime() - 2000).toISOString().slice(0, 19).replace('T', ' ');
  const to = new Date(finishedAt.getTime() + 2000).toISOString().slice(0, 19).replace('T', ' ');
  console.log('\nTo remove the scans this run added from the analytics, run this in the Neon SQL editor (check with SELECT COUNT(*) first):');
  console.log(`DELETE FROM scan_events WHERE scanned_by IS NULL AND scanned_at BETWEEN '${from}' AND '${to}';`);
})();
