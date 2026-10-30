#!/usr/bin/env python3
"""
Clean the scraped Rwanda FDA product list and pick a balanced demo subset.

  python3 scripts/curate_catalog.py <input.csv> [--per-category 20] [--max-manufacturers 15]

Writes to ./data/:
  catalog_clean_all.csv         every row, normalised (use this for the full import later)
  manufacturers_clean_all.csv   one row per distinct manufacturer
  demo_catalog.csv              the balanced demo subset
  demo_manufacturers.csv        the manufacturers used by the demo subset
Re-running is safe: the selection is deterministic.
"""
import argparse, re, sys
from collections import Counter
from datetime import datetime
import pandas as pd

ap = argparse.ArgumentParser()
ap.add_argument('input'); ap.add_argument('--per-category', type=int, default=20)
ap.add_argument('--max-manufacturers', type=int, default=15); ap.add_argument('--out', default='data')
args = ap.parse_args()

df = pd.read_csv(args.input, dtype=str).fillna('')
clean = lambda v: re.sub(r'\s+', ' ', '' if v.strip() in ('—', '-', 'N/A') else v).strip()

CATEGORY = {'Antibiotic': 'Antibiotic', 'Antimalarial': 'Antimalarial', 'Antiretroviral / HIV': 'ARV'}

# --- manufacturers: collapse spelling variants ("X Ltd," / "X LIMITED") onto one name ---
def mkey(n):
    n = re.sub(r'[.,]', ' ', n.upper())
    n = re.sub(r'\bLIMITED\b', 'LTD', n); n = re.sub(r'\bPRIVATE\b', 'PVT', n)
    return re.sub(r'\s+', ' ', n).strip()

def nice(n):
    n = re.sub(r'[\s,.;]+$', '', clean(n))
    # Re-case names that are ALL CAPS or all lower-case after the first letter; keep mixed-case brands (e.g. "GmbH").
    if not any(w[1:] != w[1:].lower() and w[1:] != w[1:].upper() for w in n.split()) and not re.search(r'[a-z][A-Z]', n):
        n = n.title()
    n = re.sub(r'\bGmbh\b', 'GmbH', n)
    n = re.sub(r'\b(Llc|Plc|Sa|Ag|Pvt|Ltd)\b', lambda m: m.group(1).upper() if m.group(1) in ('Llc', 'Plc', 'Sa', 'Ag') else m.group(1), n)
    return n

df['mf_raw'] = df['Manufacturer'].map(clean)
df['mf_key'] = df['mf_raw'].map(mkey)
display = df[df.mf_key != ''].groupby('mf_key')['mf_raw'].agg(lambda s: nice(Counter(s).most_common(1)[0][0]))
df['manufacturer'] = df['mf_key'].map(display).fillna('')

COUNTRY = {'SULTANATE OF OMAN': 'Oman', "PEOPLE'S REPUBLIC OF CHINA": 'China', 'UNITED KINGDOM': 'United Kingdom', 'UAE': 'United Arab Emirates'}
def country(c):
    c = clean(c)
    return COUNTRY.get(c.upper(), c.title())
df['country'] = df['Country'].map(country)

# --- strength: use the column; fall back to the number in the generic name ---
UNIT = r'(?:mg|g|mcg|µg|iu|ml|%)'
STR = re.compile(rf'\d+(?:[.,]\d+)?\s?{UNIT}(?:\s*(?:/|\+)\s*\d+(?:[.,]\d+)?\s?{UNIT}?)*', re.I)
def strength(row):
    s = clean(row['Strength'])
    if not s:
        m = STR.search(row['Generic Name'])
        s = m.group(0) if m else ''
    return re.sub(r'(\d)\s*(mg|g|mcg|µg|iu|ml)\b', r'\1 \2', s, flags=re.I)
df['strength'] = df.apply(strength, axis=1)

# --- dosage form: 142 spellings -> a short controlled list ---
def form(v):
    t = v.lower()
    if 'inject' in t or 'infusion' in t: return 'Injection'
    if 'tablet' in t:
        if 'disper' in t: return 'Dispersible tablet'
        if 'chew' in t: return 'Chewable tablet'
        if 'film' in t: return 'Film-coated tablet'
        return 'Tablet'
    if 'capsule' in t: return 'Capsule'
    if 'suspension' in t: return 'Oral suspension'
    if 'syrup' in t or 'solution' in t: return 'Oral solution'
    if any(k in t for k in ('cream', 'ointment', 'gel', 'lotion')): return 'Topical'
    if 'drop' in t: return 'Drops'
    if 'powder' in t or 'sachet' in t: return 'Powder'
    return ''
df['dosage_form'] = df['Dosage Form'].map(form)
df['dosage_form_original'] = df['Dosage Form'].map(clean)

df['shelf_life_months'] = df['Shelf Life'].map(lambda v: (re.search(r'\d+', v) or [''])[0])
df['category'] = df['Preliminary Category'].map(CATEGORY).fillna('')
iso = lambda v: (lambda d: d.strftime('%Y-%m-%d') if d is not pd.NaT else '')(pd.to_datetime(v, format='%d/%m/%Y', errors='coerce')) if v.strip() else ''
df['registration_date'] = df['Registration Date'].map(iso)
df['registration_expiry'] = df['Expiry Date'].map(iso)
df['pack_size'] = df['Pack Size'].map(clean)

ORAL = {'Tablet', 'Film-coated tablet', 'Dispersible tablet', 'Chewable tablet', 'Capsule', 'Oral suspension', 'Oral solution'}
df['complete'] = (df.strength != '') & df.dosage_form.isin(ORAL) & (df.shelf_life_months != '') & (df.manufacturer != '') & (df.country != '')
df['generic_key'] = df['Generic Name'].str.lower().str.extract(r'^([a-z\-]+)')[0].fillna('')

out_cols = {'Registration Number': 'registration_number', 'Brand Name': 'brand_name', 'Generic Name': 'generic_name',
            'Keyword Evidence': 'keyword_evidence', 'Review Status': 'source_review_status'}
full = df.rename(columns=out_cols)[['registration_number', 'brand_name', 'generic_name', 'strength', 'dosage_form', 'dosage_form_original',
      'pack_size', 'shelf_life_months', 'category', 'manufacturer', 'country', 'registration_date', 'registration_expiry',
      'keyword_evidence', 'source_review_status', 'complete']]

# --- demo selection: few manufacturers, balanced categories, complete rows only ---
# Rows the keyword classifier got wrong or that make a confusing demo (eye drops, mixed-class kits, TB combos).
EXCLUDE = r'levofloxacin.*1\.5|secnidazole|fluconazole|isoniazid|pyridoxine'
pool = full[full.complete & (full.category != '') & ~full.generic_name.str.contains(EXCLUDE, case=False, regex=True)].copy()
pool['generic_key'] = df.loc[pool.index, 'generic_key']
pool = pool.drop_duplicates(['manufacturer', 'generic_key', 'strength', 'dosage_form'])
need = {c: args.per_category for c in ('Antimalarial', 'ARV', 'Antibiotic')}
CAP = 6
chosen = []
while len(chosen) < args.max_manufacturers and any(v > 0 for v in need.values()):
    best, best_gain = None, 0
    for m, g in pool.groupby('manufacturer'):
        if m in chosen: continue
        gain = sum(min(need[c], CAP, n) * (3 if c == 'Antimalarial' else 1) for c, n in g.category.value_counts().items())
        if gain > best_gain: best, best_gain = m, gain
    if best is None: break
    chosen.append(best)
    for c, n in pool[pool.manufacturer == best].category.value_counts().items():
        need[c] -= min(need[c], CAP, n)

picked = []
left = {c: args.per_category for c in need}
for m in chosen:                       # round-robin across manufacturers, CAP rows per manufacturer per category
    for c in left:
        rows = pool[(pool.manufacturer == m) & (pool.category == c)].head(min(CAP, left[c]))
        picked.append(rows); left[c] -= len(rows)
demo = pd.concat(picked).drop(columns=['complete']).sort_values(['category', 'manufacturer', 'generic_name'])
mf_all = full[full.manufacturer != ''].groupby('manufacturer').agg(country=('country', 'first'), products=('registration_number', 'count'),
        categories=('category', lambda s: ' / '.join(sorted(set(s) - {''})))).reset_index()
mf_demo = mf_all[mf_all.manufacturer.isin(demo.manufacturer)].copy()
mf_demo['demo_products'] = mf_demo.manufacturer.map(demo.manufacturer.value_counts())

import os; os.makedirs(args.out, exist_ok=True)
full.to_csv(f'{args.out}/catalog_clean_all.csv', index=False)
mf_all.to_csv(f'{args.out}/manufacturers_clean_all.csv', index=False)
demo.to_csv(f'{args.out}/demo_catalog.csv', index=False)
mf_demo.to_csv(f'{args.out}/demo_manufacturers.csv', index=False)

print(f'rows: {len(df)} | complete: {int(df.complete.sum())} | distinct manufacturers: {df.manufacturer.replace("", pd.NA).nunique()} '
      f'(raw spellings: {df.mf_raw.replace("", pd.NA).nunique()})')
print(f'demo: {len(demo)} products from {demo.manufacturer.nunique()} manufacturers')
print(demo.category.value_counts().to_string())
print(mf_demo.sort_values('demo_products', ascending=False).to_string(index=False))
