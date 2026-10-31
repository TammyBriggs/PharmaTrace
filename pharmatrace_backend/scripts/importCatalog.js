// Usage (from pharmatrace_backend/):
//   node scripts/importCatalog.js                          -> data/demo_catalog.csv
//   node scripts/importCatalog.js data/catalog_clean_all.csv
//   node scripts/importCatalog.js --dry-run                -> validate only, write nothing
// Idempotent: re-running updates existing products by registration_number.
const fs = require('fs');
const path = require('path');

const CATEGORIES = ['Antimalarial', 'Antibiotic', 'ARV'];

// Minimal RFC-4180 parser (quoted fields, escaped quotes, CRLF). Avoids a new dependency.
function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f); f = ''; if (row.some((x) => x !== '')) rows.push(row); row = [];
    } else f += c;
  }
  if (f !== '' || row.length) { row.push(f); if (row.some((x) => x !== '')) rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

// The scrape left stray backslashes and curly apostrophes in pack sizes ("30\\\'s", "180’s").
const cleanPack = (s) => s.replace(/\\+/g, '').replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim();
const asDate = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) ? s : null);

function toProduct(r) {
  const p = {
    registration_number: r.registration_number, brand_name: r.brand_name, generic_name: r.generic_name,
    strength: r.strength, dosage_form: r.dosage_form, pack_size: cleanPack(r.pack_size || ''),
    shelf_life_months: parseInt(r.shelf_life_months, 10), category: r.category,
    manufacturer_name: r.manufacturer, country: r.country,
    registration_date: asDate(r.registration_date), registration_expiry: asDate(r.registration_expiry),
    source_review_status: r.source_review_status || null,
  };
  const missing = ['registration_number', 'brand_name', 'generic_name', 'strength', 'dosage_form', 'pack_size', 'manufacturer_name', 'country']
    .filter((k) => !p[k]);
  if (missing.length) return { error: `missing ${missing.join(', ')}` };
  if (!(p.shelf_life_months > 0)) return { error: 'shelf_life_months must be a positive integer' };
  if (!CATEGORIES.includes(p.category)) return { error: `category "${p.category}" not one of ${CATEGORIES.join('/')}` };
  return { product: p };
}

const SQL = `INSERT INTO products (registration_number, brand_name, generic_name, strength, dosage_form, pack_size,
    shelf_life_months, category, manufacturer_name, country, registration_date, registration_expiry, source_review_status)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
  ON CONFLICT (registration_number) DO UPDATE SET
    brand_name=EXCLUDED.brand_name, generic_name=EXCLUDED.generic_name, strength=EXCLUDED.strength,
    dosage_form=EXCLUDED.dosage_form, pack_size=EXCLUDED.pack_size, shelf_life_months=EXCLUDED.shelf_life_months,
    category=EXCLUDED.category, manufacturer_name=EXCLUDED.manufacturer_name, country=EXCLUDED.country,
    registration_date=EXCLUDED.registration_date, registration_expiry=EXCLUDED.registration_expiry,
    source_review_status=EXCLUDED.source_review_status, updated_at=now()`;

/** Validates every row first; writes nothing if `dryRun` or if any row is invalid. */
async function importRows(pool, rawRows, { dryRun = false } = {}) {
  const good = [], bad = [];
  rawRows.forEach((r, i) => {
    const { product, error } = toProduct(r);
    if (error) bad.push(`row ${i + 2} (${r.registration_number || '?'}): ${error}`); else good.push(product);
  });
  const dup = good.map((p) => p.registration_number).filter((x, i, a) => a.indexOf(x) !== i);
  if (dup.length) bad.push(`duplicate registration numbers in file: ${[...new Set(dup)].join(', ')}`);
  if (bad.length || dryRun) return { inserted: 0, updated: 0, valid: good.length, errors: bad };

  const c = await pool.connect(); let inserted = 0, updated = 0;
  try {
    await c.query('BEGIN');
    const have = new Set((await c.query('SELECT registration_number FROM products')).rows.map((r) => r.registration_number));
    for (const p of good) {
      await c.query(SQL, [p.registration_number, p.brand_name, p.generic_name, p.strength, p.dosage_form,
        p.pack_size, p.shelf_life_months, p.category, p.manufacturer_name, p.country, p.registration_date,
        p.registration_expiry, p.source_review_status]);
      have.has(p.registration_number) ? updated++ : inserted++;
    }
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  return { inserted, updated, valid: good.length, errors: [] };
}

module.exports = { parseCsv, importRows, cleanPack };

if (require.main === module) {
  const pool = require('../config/db');
  const args = process.argv.slice(2);
  const file = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(__dirname, '..', 'data', 'demo_catalog.csv'));
  const dryRun = args.includes('--dry-run');
  (async () => {
    const res = await importRows(pool, parseCsv(fs.readFileSync(file, 'utf8')), { dryRun });
    console.log(`${dryRun ? '[dry run] ' : ''}${path.basename(file)}: ${res.valid} valid rows, ${res.inserted} inserted, ${res.updated} updated`);
    if (res.errors.length) { console.error('Nothing was written. Fix these first:\n - ' + res.errors.join('\n - ')); process.exitCode = 1; }
    await pool.end();
  })().catch((e) => { console.error(e.message); process.exit(1); });
}
