export const num = (n: number) => n.toLocaleString('en-US');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-10-02" or a Date -> "02 Oct 2026" / "02 Oct"
export function fmtDay(d: string | Date, withYear = true): string {
  const [y, m, day] = typeof d === 'string'
    ? d.split('-').map(Number)
    : [d.getFullYear(), d.getMonth() + 1, d.getDate()];
  const base = `${String(day).padStart(2, '0')} ${MONTHS[m - 1]}`;
  return withYear ? `${base} ${y}` : base;
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

export const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin', regulator: 'Regulator', manufacturer: 'Manufacturer',
};

const CATEGORY_LABEL: Record<string, string> = {
  Antimalarial: 'Antimalarials', Antibiotic: 'Antibiotics', ARV: 'ARVs',
};
export const categoryLabel = (c: string) => CATEGORY_LABEL[c] ?? c;
