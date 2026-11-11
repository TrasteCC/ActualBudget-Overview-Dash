import fs from 'node:fs';
import path from 'node:path';
import { demoState, isDemo } from './demo-state';

export { isDemo };

// Every rule the dashboard applies is configuration, never code. The environment gives the defaults;
// the settings page saves overrides to settings.json in the data volume, and "Reset" deletes them.

export interface Settings {
  actualUrl: string;
  excludedAccounts: string[]; // names or ids, lower-cased
  excludedCategories: string[]; // names or ids, lower-cased
  hiddenTags: string[];       // lower-cased, with '#'
  locale: string;
  currency: string;
  historySince: string;       // YYYY-MM-DD
  syncIntervalMin: number;
}

export type EditableSettings = Omit<Settings, 'actualUrl'>;
export const EDITABLE: (keyof EditableSettings)[] = ['excludedAccounts', 'excludedCategories', 'hiddenTags', 'locale', 'currency', 'historySince', 'syncIntervalMin'];

export class InvalidSetting extends Error {}


const list = (v: string | undefined) =>
  (v || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const tag = (v: string) => (v.startsWith('#') ? v : `#${v}`).toLowerCase();
const TAG_OK = /^#[\p{L}\p{N}_-]+$/u;

function defaultSince(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 13);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

// An invalid LOCALE/CURRENCY in env would crash number formatting in the UI; fall back instead.
function formatOk(locale: string, currency: string): boolean {
  try { new Intl.NumberFormat(locale, { style: 'currency', currency }); return true; } catch { return false; }
}

export function envSettings(): Settings {
  const e = process.env;
  const fmt = formatOk(e.LOCALE || 'en-US', e.CURRENCY || 'EUR');
  return {
    actualUrl: isDemo() ? '' : (e.ACTUAL_SERVER_URL || '').replace(/\/$/, ''),
    excludedAccounts: list(e.EXCLUDED_ACCOUNTS),
    excludedCategories: list(e.EXCLUDED_CATEGORIES),
    hiddenTags: list(e.HIDDEN_TAGS ?? (isDemo() ? '#auto' : '')).map(tag),
    locale: fmt ? e.LOCALE || 'en-US' : 'en-US',
    currency: fmt ? e.CURRENCY || 'EUR' : 'EUR',
    historySince: /^\d{4}-\d{2}-\d{2}$/.test(e.HISTORY_SINCE || '') ? e.HISTORY_SINCE! : defaultSince(),
    syncIntervalMin: Math.max(1, Number(e.SYNC_INTERVAL_MIN) || 15),
  };
}

const file = () => path.join(process.env.ACTUAL_DATA_DIR || './data', 'settings.json');

// The demo never touches settings.json: each visitor's overrides live in memory (see demo-state.ts).
const demoSettings = demoState<Partial<EditableSettings>>('settings');

function readOverrides(visitor?: string): Partial<EditableSettings> {
  if (isDemo()) return demoSettings.get(visitor) || {};
  try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { return {}; }
}

export function getSettings(visitor?: string): Settings {
  const o = readOverrides(visitor);
  const s = envSettings();
  for (const k of EDITABLE) if (o[k] !== undefined) (s as unknown as Record<string, unknown>)[k] = o[k];
  return s;
}

export function overriddenKeys(visitor?: string): (keyof EditableSettings)[] {
  const o = readOverrides(visitor);
  return EDITABLE.filter(k => o[k] !== undefined);
}

function strList(v: unknown, name: string): string[] {
  if (typeof v === 'string') return list(v);
  if (Array.isArray(v) && v.every(x => typeof x === 'string')) return list(v.join(','));
  throw new InvalidSetting(`${name} must be a list`);
}

function validate(b: Record<string, unknown>): Partial<EditableSettings> {
  const out: Partial<EditableSettings> = {};
  if (b.excludedAccounts !== undefined) out.excludedAccounts = strList(b.excludedAccounts, 'Excluded accounts');
  if (b.excludedCategories !== undefined) out.excludedCategories = strList(b.excludedCategories, 'Excluded categories');
  if (b.hiddenTags !== undefined) {
    const ts = strList(b.hiddenTags, 'Hidden tags').map(tag);
    const bad = ts.find(t => !TAG_OK.test(t));
    if (bad) throw new InvalidSetting(`Invalid tag: ${bad}`);
    out.hiddenTags = ts;
  }
  if (b.locale !== undefined) {
    try { out.locale = Intl.getCanonicalLocales(String(b.locale).trim())[0]; } catch { /* below */ }
    if (!out.locale) throw new InvalidSetting('Unknown locale (try en-US, de-DE, es-ES…)');
  }
  if (b.currency !== undefined) {
    const c = String(b.currency).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(c)) throw new InvalidSetting('Currency must be a 3-letter ISO code, e.g. EUR');
    out.currency = c;
  }
  if (b.historySince !== undefined) {
    const d = String(b.historySince);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) throw new InvalidSetting('History start must be a date (YYYY-MM-DD)');
    out.historySince = d;
  }
  if (b.syncIntervalMin !== undefined) {
    const n = Number(b.syncIntervalMin);
    if (!Number.isInteger(n) || n < 1 || n > 1440) throw new InvalidSetting('Sync interval must be 1–1440 minutes');
    out.syncIntervalMin = n;
  }
  return out;
}

// Only values that differ from the environment are stored, so untouched fields keep following env.
export function saveSettings(input: Record<string, unknown>, visitor?: string): Settings {
  const next: Partial<EditableSettings> = { ...readOverrides(visitor), ...validate(input) };
  const env = envSettings();
  const same = (a: unknown, b: unknown) =>
    JSON.stringify(Array.isArray(a) ? [...a].sort() : a) === JSON.stringify(Array.isArray(b) ? [...b].sort() : b);
  for (const k of EDITABLE) if (same(next[k], env[k])) delete next[k];
  if (isDemo()) {
    if (visitor) demoSettings.set(visitor, next);
    return getSettings(visitor);
  }
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(`${file()}.tmp`, JSON.stringify(next, null, 2));
  fs.renameSync(`${file()}.tmp`, file());
  return getSettings();
}

export function resetSettings(visitor?: string): Settings {
  if (isDemo()) demoSettings.delete(visitor);
  else fs.rmSync(file(), { force: true });
  return getSettings(visitor);
}
