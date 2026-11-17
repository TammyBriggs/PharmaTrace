import { currentLang } from '../i18n';

export const num = (n: number) => n.toLocaleString('en-US');

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Kinyarwanda months: Mutarama, Gashyantare, Werurwe, Mata, Gicurasi, Kamena, Nyakanga, Kanama, Nzeri, Ukwakira, Ugushyingo, Ukuboza.
const MONTHS_RW = ['Mut', 'Gas', 'Wer', 'Mat', 'Gic', 'Kam', 'Nya', 'Kan', 'Nze', 'Ukw', 'Ugu', 'Uku'];
const months = () => (currentLang() === 'rw' ? MONTHS_RW : MONTHS_EN);

// "2026-10-02" or a Date -> "02 Oct 2026" / "02 Oct"
export function fmtDay(d: string | Date, withYear = true): string {
  const [y, m, day] = typeof d === 'string'
    ? d.split('-').map(Number)
    : [d.getFullYear(), d.getMonth() + 1, d.getDate()];
  const base = `${String(day).padStart(2, '0')} ${months()[m - 1]}`;
  return withYear ? `${base} ${y}` : base;
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

// ISO instant ("2026-11-05T18:20:11Z") -> "05 Nov 2026, 20:20" in Kigali time, whatever the viewer's time zone is.
export function fmtDateTime(iso: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Kigali', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
}
