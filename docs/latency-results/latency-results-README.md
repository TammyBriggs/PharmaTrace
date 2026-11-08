# Latency test results

Raw output of `pharmatrace_backend/scripts/latencyTest.js` (`pharmatrace_backend/scripts/latencyTable.js` prints any of these files as tables), run from a laptop in Kigali against the hosted system on 6 November 2026.
File names carry the start time in UTC (Kigali is UTC+2). Each run sends 21 requests per test, 1.2 seconds apart.

| File | Backend | Chain reads | Notes |
|---|---|---|---|
| `latency-chain-off-2026-11-06T12-59-56-009Z.json` | Render, Oregon | Off | First run, after a quiet period. Made with the first version of the script, so it has no connection-setup split. |
| `latency-chain-off-2026-11-06T13-07-45-930Z.json` | Render, Oregon | Off | Warm server. First version of the script. |
| `latency-chain-on-2026-11-06T13-36-03-597Z.json` | Render, Oregon | On | Warm server. The first request of each host includes about 5 seconds of DNS lookup on the test network, so read the medians, not the first-request time. |
| `latency-chain-on-2026-11-06T14-01-20-149Z.json` | Render, Oregon | On | Run after 16 minutes idle. No cold start was seen (server wait on the first request was normal). |
| `latency-frankfurt-2026-11-06T14-52-28-167Z.json` | Render, Frankfurt | On in settings, but the blockchain call was failing | Every scan reply said "database", so treat this run as database-only. Shows the cost of the backend and database being in the same region. |
| `latency-frankfurt-2026-11-06T15-03-37-120Z.json` | Render, Frankfurt | Off | Every scan reply said "database". Use this run for the Frankfurt chain-off result. |
| `latency-frankfurt-2026-11-06T15-09-18-299Z.json` | Render, Frankfurt | On, working | Scan replies said "blockchain + database". Use this run for the Frankfurt chain-on result. |
| `latency-frankfurt-web-2026-11-06T15-32-01-263Z.json` | Render, Frankfurt | On | Scan replies said "blockchain + database". Also times the dashboard page on Vercel and a scan sent through the Vercel `/api` forward. |

The database (Neon) is in Frankfurt in every run. The dashboard (Vercel) was measured in the first four runs and in the last run (the file with `web` in its name).
