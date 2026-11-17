import type { Key } from '../i18n';

// The same rules the server enforces (utils/password.js), so people see what is wrong before they submit.
export const PASSWORD_RULES: { key: string; labelKey: Key; ok: (pw: string) => boolean }[] = [
  { key: 'len', labelKey: 'pw.ruleLen', ok: (p) => p.length >= 8 },
  { key: 'letter', labelKey: 'pw.ruleLetter', ok: (p) => /[A-Za-z]/.test(p) },
  { key: 'digit', labelKey: 'pw.ruleDigit', ok: (p) => /\d/.test(p) },
];
export const passwordOk = (pw: string) => PASSWORD_RULES.every((r) => r.ok(pw));
