# PharmaTrace

PharmaTrace is an anti-counterfeit medicine verification system for Rwanda. Manufacturers register batches, the Rwanda FDA approves them on an Ethereum smart contract, and anyone can scan the QR code on a pack to learn at once whether it is authentic, pending, expired, flagged or revoked.

| | |
|---|---|
| **Author** | Tamunotonye Briggs, African Leadership University (BSc Software Engineering, Low-Level Programming track) |
| **Repository** | https://github.com/TammyBriggs/PharmaTrace |
| **Walkthrough video** | _add link here_ |
| **Technical report (PDF)** | _add link here_ |
| **Figma** | https://www.figma.com/design/i8k7qcRAaYYRulinorFO43/Untitled?node-id=3-1274 |

---

## What is built

The system has four parts that work together end to end.

| Part | What it does | Folder |
|---|---|---|
| **Smart contract** | Roles, batch life cycle (pending, approved, flagged, revoked), and the verdict returned on every scan | `contracts/` |
| **Backend API** | Node.js and Express with PostgreSQL. Verifies scans (database and blockchain), serial numbers, sales, reports, audit log, analytics | `pharmatrace_backend/` |
| **Web dashboard** | React. Regulators approve, flag and revoke batches and manufacturers; manufacturers submit batches and print QR labels. Transactions are signed in MetaMask | `pharmatrace_dashboard/` |
| **Mobile app** | Flutter. Patients scan anonymously; pharmacists sign in to record sales and report suspicious products | `pharmatrace_mobile/` |

### Feature overview

**Smart contract:** role-based access (admin, regulator, manufacturer); manufacturer registration and revocation; batch submit, approve, flag, resolve flag, revoke, reinstate; one public `verifyBatch` verdict (`Authentic`, `Pending`, `Flagged`, `Expired`, `ManufacturerRevoked`, `BatchRevoked`, `NotFound`); an emergency pause that can never block a recall.

**Backend:** JWT login with role checks; GS1 Digital Link parsing with a check-digit test; a unique serial number for every pack; scan verification that combines the database and the contract (worst result wins); sale recording (a pack sold twice is flagged as a duplicate); a hash-chained audit log; scan analytics by sector; flag-report review; notifications; global search.

**Web dashboard:** overview, manufacturers (add, approve on-chain, detail page), batches (list, detail, provenance timeline, approve, flag, resolve, revoke, reinstate), QR label printing, flag reports, scan analytics, audit log with chain verification, notifications, global search, and a separate overview for manufacturer accounts.

**Mobile app:** QR scanning and manual entry by batch number (GTIN and pack serial optional); verification result with the plain-language reason; batch history timeline; "mark as dispensed" and "report product" for pharmacists; scan history saved on the phone; light and dark themes; Gasabo District sector selection for pharmacists.

### Scope status

| Feature | Status |
|---|---|
| Smart contract with roles, life cycle and verdicts | Complete |
| Regulator and manufacturer web dashboard | Complete |
| Mobile scan and verify (patients and pharmacists) | Complete |
| Pack-level serial numbers and sale recording | Complete |
| Audit log with hash chain | Complete |
| Scan analytics by sector | Complete |
| Pharmacist accounts created by a regulator | Partial (create works; emailed temporary password and password reset are not built) |
| Deployment to a public test network (Sepolia) | Not done (runs on a local Hardhat chain) |
| Production hosting in Rwanda | Not done (development runs through an ngrok tunnel) |

---

## How it works

1. The **regulator** registers a licensed manufacturer. The contract stores its wallet and a hash of its licence.
2. The **manufacturer** saves a batch in the dashboard, signs `submitBatch` in MetaMask, and the API checks the receipt, then creates one serial number per pack. The batch is `Pending`.
3. The **regulator** signs `approveBatch`. The batch becomes `Approved`. A regulator can also flag or revoke a batch with a reason, and later resolve or reinstate it.
4. The **manufacturer** prints QR labels. Each code is a GS1 Digital Link: `/01/<GTIN>/10/<batch>/21/<serial>`.
5. **Anyone** scans a code. The API reads the batch from the database and the contract, combines the two, applies the per-pack state, and returns one verdict. Pharmacists can then record the sale of that exact pack.

| Role | Can do |
|---|---|
| Admin (`DEFAULT_ADMIN_ROLE`) | Pause or unpause the contract |
| Regulator (`REGULATOR_ROLE`) | Register or revoke manufacturers; approve, flag, resolve, revoke, reinstate batches |
| Manufacturer (`MANUFACTURER_ROLE`) | Submit batches |
| Pharmacist (app account) | Scan, record sales, report suspicious products |
| Anyone | Verify a batch or pack, view its public history |

The chain stores only wallet addresses, timestamps, statuses and hashes. Names, licence numbers, drug details and flag reasons stay in the off-chain database and are anchored on-chain by hash.

---

## Technical requirements

| Tool | Version used |
|---|---|
| Node.js | 20 or 22 (LTS) |
| npm | 10 or later |
| PostgreSQL | 13 or later (developed on Neon) |
| Hardhat | 2.29, with `@nomicfoundation/hardhat-toolbox` 5 |
| Solidity | 0.8.28, OpenZeppelin Contracts 5.6 |
| Express | 5 |
| ethers | 6.17 |
| React | 19, with Vite 8, TypeScript and Tailwind CSS 4 |
| Flutter | 3.35 or later (Dart 3.9.2 or later) |
| MetaMask | Browser extension, for dashboard signing |
| ngrok | Optional, to reach the API from a physical phone |
| Phone | Android (tested on a Tecno Camon 15) |

---

## Installation

### 1. Clone and install

```bash
git clone https://github.com/TammyBriggs/PharmaTrace.git
cd PharmaTrace
npm install                          # Hardhat and OpenZeppelin
cd pharmatrace_backend && npm install && cd ..
cd pharmatrace_dashboard && npm install && cd ..
```

### 2. Start a local chain and deploy the contract

```bash
npx hardhat node                                          # terminal 1, leave running
npx hardhat run scripts/deploy.js --network localhost     # terminal 2
```

`deploy.js` writes the contract address and ABI to `pharmatrace_backend/chain/`. Import Hardhat account #1 (regulator) and later accounts into MetaMask, and add the network `http://127.0.0.1:8545`, chain ID `31337`.

### 3. Configure and prepare the database

Create `pharmatrace_backend/.env` (never commit it):

```
DATABASE_URL=postgres://user:password@host/dbname
JWT_SECRET=<a long random string>
RPC_URL=http://127.0.0.1:8545
PUBLIC_BASE_URL=http://localhost:3000        # or your ngrok address; this is what QR codes point to
ALLOWED_ORIGINS=http://localhost:5173
PORT=3000
OBJECT_STORAGE_ENDPOINT=...                  # S3-compatible storage for report photos and profile pictures
OBJECT_STORAGE_BUCKET=...
OBJECT_STORAGE_ACCESS_KEY=...
OBJECT_STORAGE_SECRET_KEY=...
```

```bash
cd pharmatrace_backend
node scripts/migrate.js                                   # builds all tables (001 to 007); safe to re-run
node scripts/importCatalog.js                             # product catalogue (add data/catalog_clean_all.csv for all 513 products)

# A regulator login, plus the demo super admin if you want one:
SEED_CONTACT=admin@example.com SEED_PASSWORD='...' node scripts/seedSuperAdmin.js
REGULATOR_CONTACT=regulator@example.com REGULATOR_PASSWORD='...' \
MANUFACTURER_CONTACT=maker@example.com MANUFACTURER_PASSWORD='...' node scripts/seedDemoAccounts.js
```

### 4. Fill the dashboard with demo data (optional)

```bash
node scripts/seedDemoData.js --yes
```

This erases manufacturers, batches, serials, scans and flag reports, then creates 6 manufacturers (Hardhat wallets #3 to #8), about 45 batches in mixed states with real on-chain transactions, serial numbers, around 700 scans across Gasabo's 15 sectors, and a few flag reports. Wallet #2 and "Macleods Pharmaceuticals Limited" are left out so they can be added by hand. Run it on a fresh chain (restart `npx hardhat node` and redeploy first).

> The seeded **database** timestamps are back-dated over about 75 days so the charts show a history. Transaction hashes are real, but block times on the local chain are the time you ran the script. This is demo data only. The script refuses to run on any chain except 31337.

### 5. Run the API and the dashboard

```bash
cd pharmatrace_backend && npm start            # http://localhost:3000
cd pharmatrace_dashboard && npm run dev        # http://localhost:5173
```

### 6. Run the mobile app

```bash
cd pharmatrace_mobile
flutter pub get
dart run flutter_native_splash:create          # builds the native splash screens from assets/images
flutter run --dart-define=API_BASE_URL=https://<your-ngrok-address>
```

The app adds `/api` itself. Without `--dart-define` it uses the default in `lib/core/config.dart`. On the Android emulator use `http://10.0.2.2:3000`. A physical phone needs a public address, for example `ngrok http 3000`; set the same address as `PUBLIC_BASE_URL` in the backend `.env`.

---

## Testing

| Level | Command | What it covers |
|---|---|---|
| Contract unit tests | `npx hardhat test` (repo root) | Roles, batch life cycle, flag and revoke, manufacturer revocation, emergency pause, expiry |
| Unit tests | `cd pharmatrace_backend && npm test` | GS1 check digit, GTIN derivation, serial alphabet, Digital Link parsing |
| API integration tests | same command (needs the API running and seeded data) | Verdicts against the real database and contract, batch-number lookup, bad input, public history order, authentication, audit chain |
| Device testing | Manual | Tecno Camon 15 over a mobile network, light and dark themes, patient and pharmacist flows |
| Performance | ngrok traffic inspector | Scan requests through the tunnel measured per request |

---

## Repository structure

```
PharmaTrace/
├── contracts/PharmaTrace.sol            # Smart contract
├── scripts/deploy.js                    # Deploys the contract to the local chain
├── test/PharmaTrace.test.js             # Contract unit tests
├── hardhat.config.js
├── pharmatrace_backend/
│   ├── server.js                        # Express app
│   ├── config/                          # Database, blockchain and storage setup
│   ├── routes/ controllers/             # One pair per area: auth, batches, verify, serials, reports, analytics, ...
│   ├── middleware/                      # JWT check and role check
│   ├── utils/                           # GS1 helpers and the audit hash chain
│   ├── migrations/                      # SQL, applied in order by scripts/migrate.js
│   ├── scripts/                         # migrate, import catalogue, seed accounts and demo data, reset, verify audit chain
│   ├── data/                            # Rwanda FDA product catalogue (CSV)
│   └── tests/                           # Unit and integration tests
├── pharmatrace_dashboard/src/
│   ├── pages/                           # One file per screen
│   ├── components/                      # Reusable parts (shell, modal, notifications, search)
│   ├── lib/                             # API client, wallet, types, formatting
│   └── auth/                            # Login state and role guard
├── pharmatrace_mobile/lib/
│   ├── core/                            # Theme, sectors, config, shared widgets
│   ├── data/                            # Models and API service
│   └── features/                        # scan, verification, history, profile, auth, onboarding
└── docs/designs/                        # Figma exports
```

---

## Design notes

- **Separation of concerns:** routes only map URLs; controllers hold the rules; `utils` holds pure logic (GS1, audit chain) so it can be tested alone. The dashboard keeps API calls in `lib/` and screens in `pages/`. The app keeps models, services and screens apart.
- **Algorithms:** GS1 mod-10 check digit and Digital Link parsing; a collision-free serial generator (32-symbol alphabet with no look-alike characters, 32^12 combinations, no modulo bias); a SHA-256 hash chain over the audit log with an advisory lock so writers never fork it; a status replay that rebuilds each batch's status after every event for the timeline; a "worst result wins" merge of the database and the contract.
- **Client signs, server verifies:** the browser wallet signs every on-chain action; the API reads the receipt and refuses anything that does not match the batch and the wallet.

## Security measures

| Threat | Measure |
|---|---|
| Unauthorized writes on-chain | OpenZeppelin `AccessControl` with separate admin, regulator and manufacturer roles |
| A manufacturer approving its own batch | Submit and approve are different roles |
| A compromised manufacturer | `revokeManufacturer` turns all its batches into `ManufacturerRevoked` |
| Live incident | `pause()` stops writes; flag and revoke stay callable so a recall is never blocked |
| Unauthorized API use | JWT login, bcrypt password hashes, role checks on every dashboard route, CORS allow-list |
| Forged on-chain actions | The API verifies the transaction receipt, the batch, the wallet and the signed reason hash |
| Tampering with history | Hash-chained audit log, verifiable from the dashboard |
| Guessing pack serials | 12-character random serials (32^12 possibilities) |
| Personal data on-chain | Only addresses, timestamps, statuses and hashes are stored |

## Known limitations

- The API rate limiter keeps its counts in memory. It resets on restart and does not share counts between servers.
- Everything runs on a local chain. A public test network and hosting in Rwanda are future steps.
- A cloned QR code on a fake pack is only caught when the same serial is sold twice or scanned in unusual patterns.
- Pharmacists cannot yet reset their own password.
- The ngrok free tunnel adds about half a second per request, so measured scan times include it.

---

## Designs

**Style guide:** white background, near-black text, emerald green for buttons, links and icons, Inter typeface. Red and amber appear only on verification results and alerts, always with an icon and a text label.

| Mobile | Dashboard |
|---|---|
| ![Scan](docs/designs/mobile/02-scan.png) | ![Overview](docs/designs/dashboard/02-overview.png) |
| ![Authentic](docs/designs/mobile/03-authentic.png) | ![Batch detail](docs/designs/dashboard/05-batch-detail.png) |

More screens are in `docs/designs/`.

## License

MIT
