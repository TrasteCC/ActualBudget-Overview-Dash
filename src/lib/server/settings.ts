// Every rule the dashboard applies is configuration, never code. Read once from the environment.

export interface Settings {
  actualUrl: string;
  excludedAccounts: string[]; // names or ids, lower-cased
  savingsTag: string;         // lower-cased, with '#'
  hiddenTags: string[];       // lower-cased, with '#'
  locale: string;
  currency: string;
  historySince: string;       // YYYY-MM-DD
  syncIntervalMin: number;
}

const list = (v: string | undefined) =>
  (v || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const tag = (v: string) => (v.startsWith('#') ? v : `#${v}`).toLowerCase();

function defaultSince(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 13);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export function getSettings(): Settings {
  const e = process.env;
  return {
    actualUrl: (e.ACTUAL_SERVER_URL || '').replace(/\/$/, ''),
    excludedAccounts: list(e.EXCLUDED_ACCOUNTS),
    savingsTag: tag(e.SAVINGS_TAG || '#savings'),
    hiddenTags: list(e.HIDDEN_TAGS).map(tag),
    locale: e.LOCALE || 'en-US',
    currency: e.CURRENCY || 'EUR',
    historySince: /^\d{4}-\d{2}-\d{2}$/.test(e.HISTORY_SINCE || '') ? e.HISTORY_SINCE! : defaultSince(),
    syncIntervalMin: Math.max(1, Number(e.SYNC_INTERVAL_MIN) || 15),
  };
}
