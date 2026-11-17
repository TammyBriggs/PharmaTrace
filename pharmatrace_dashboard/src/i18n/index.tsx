import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en, type Key } from './en';
import { rw } from './rw';

export type Lang = 'en' | 'rw';
export type { Key };

const STORE = 'pharmatrace.lang';
const DICT: Record<Lang, Partial<Record<Key, string>>> = { en, rw };

// Read by the plain formatting helpers (dates), which are not React components.
let current: Lang = 'en';
export const currentLang = () => current;

function initialLang(): Lang {
  try { return localStorage.getItem(STORE) === 'rw' ? 'rw' : 'en'; } catch { return 'en'; }   // English by default
}

type Vars = Record<string, string | number>;
interface I18n { lang: Lang; setLang: (l: Lang) => void; t: (key: Key, vars?: Vars) => string }
const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => { current = initialLang(); return current; });

  useEffect(() => { document.documentElement.lang = lang === 'rw' ? 'rw' : 'en'; }, [lang]);

  const setLang = useCallback((l: Lang) => {
    current = l;
    setLangState(l);
    try { localStorage.setItem(STORE, l); } catch { /* storage blocked: the choice just lasts for this visit */ }
  }, []);

  const value = useMemo<I18n>(() => ({
    lang, setLang,
    t: (key, vars) => {
      const text = DICT[lang][key] ?? en[key] ?? String(key);   // missing Kinyarwanda falls back to English
      return vars ? text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : text;
    },
  }), [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n must be used inside I18nProvider');
  return v;
}

/** English | Kinyarwanda switch. Used on the sign-in pages and in the account menu. */
export function LanguageSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  const opt = (l: Lang, label: string, name: string) => (
    <button type="button" lang={l} onClick={() => setLang(l)} aria-pressed={lang === l} aria-label={name}
      className={`h-8 min-w-11 rounded-md px-3 text-xs font-semibold transition ${
        lang === l ? 'bg-brand text-white' : 'text-mute hover:bg-canvas'}`}>
      {label}
    </button>
  );
  return (
    <div role="group" aria-label={t('common.language')} className={`inline-flex items-center gap-1 rounded-lg border border-line bg-white p-1 ${className}`}>
      {opt('en', 'EN', 'English')}
      {opt('rw', 'RW', 'Kinyarwanda')}
    </div>
  );
}
