// The same rules the server enforces (utils/password.js), so people see what is wrong before they submit.
export const PASSWORD_RULES: { key: string; label: string; ok: (pw: string) => boolean }[] = [
  { key: 'len', label: 'At least 8 characters', ok: (p) => p.length >= 8 },
  { key: 'letter', label: 'At least one letter', ok: (p) => /[A-Za-z]/.test(p) },
  { key: 'digit', label: 'At least one number', ok: (p) => /\d/.test(p) },
];
export const passwordOk = (pw: string) => PASSWORD_RULES.every((r) => r.ok(pw));
