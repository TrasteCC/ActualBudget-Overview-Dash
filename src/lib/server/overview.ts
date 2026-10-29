import { getActual, syncNow } from './actual';
import { demoSnapshot } from './demo';
import { DEMO_RESET_MIN, demoState } from './demo-state';
import { getSettings, isDemo, Settings } from './settings';

// The Overview payload: last 12 months of counted totals, per-month category spend and the decorated
// transaction rows, built from one in-memory snapshot of the budget. All filtering happens client-side.

const SNAPSHOT_TTL_MS = 2 * 60 * 1000;

export interface RawTx {
  id: string;
  date: string;
  amount: number;
  account: string;
  category?: string | null;
  payee?: string | null;
  notes?: string | null;
  transfer_id?: string | null;
  starting_balance_flag?: boolean;
  is_parent?: boolean;
  subtransactions?: RawTx[];
}

export interface Snapshot {
  accounts: { id: string; name: string; offbudget: boolean; closed: boolean }[];
  categories: { id: string; name: string; group_id: string; is_income?: boolean }[];
  groups: { id: string; name: string }[];
  payees: { id: string; name: string; transfer_acct?: string | null }[];
  rawTrans: RawTx[];
  updated: string;
}

export interface OverviewTransaction {
  id: string;
  date: string;
  amount: number;
  payee: string;
  payeeId?: string;
  category: string;
  categoryId?: string;
  notes: string;
  account?: string;
  isExcluded?: boolean;
  counted?: boolean;
  // Income side: an income category, or an uncategorized inflow. Refunds in an expense category stay expenses.
  income?: boolean;
}

export interface OverviewData {
  currentMonth: string;
  months: { key: string; income: number; expense: number; categories: Record<string, number> }[];
  averages: { ytdIncome: number; ytdExpense: number; ltmIncome: number; ltmExpense: number };
  categoryGroup: Record<string, string>;
  transactions: OverviewTransaction[];
  metadata: { updated: string; allCategories: { id: string; name: string }[]; allPayees: { id: string; name: string }[] };
  settings: { actualUrl: string; hiddenTags: string[]; locale: string; currency: string; demo: boolean };
}

// On globalThis so every route bundle shares one snapshot (the settings route invalidates it).
interface State { cache: { at: number; data: Snapshot } | null; inflight: Promise<Snapshot> | null }
const g = globalThis as typeof globalThis & { __abodOverview?: State };
const state = (g.__abodOverview ??= { cache: null, inflight: null });

// The data source seam: the real budget, or the made-up one in demo mode (never touches Actual).
async function loadSnapshot(settings: Settings): Promise<Snapshot> {
  if (isDemo()) return demoSnapshot();
  const api = await getActual();
  const [accounts, categories, groups, payees] = await Promise.all([
    api.getAccounts(), api.getCategories(), api.getCategoryGroups(), api.getPayees(),
  ]);
  const until = `${new Date().getFullYear() + 1}-12-31`;
  const rawTrans: RawTx[] = [];
  for (const acc of accounts.filter(a => !a.closed)) {
    const txs = (await api.getTransactions(acc.id, settings.historySince, until)) as unknown as RawTx[];
    for (const t of txs) {
      // Split parents carry no category; their children hold the real ones.
      if (t.is_parent && t.subtransactions?.length) {
        for (const s of t.subtransactions) {
          rawTrans.push({ ...s, account: acc.id, date: s.date || t.date, payee: s.payee || t.payee, notes: s.notes || t.notes });
        }
      } else {
        rawTrans.push({ ...t, account: acc.id });
      }
    }
  }
  return {
    accounts: accounts as Snapshot['accounts'],
    categories: categories as Snapshot['categories'],
    groups: groups as Snapshot['groups'],
    payees: payees as Snapshot['payees'],
    rawTrans,
    updated: new Date().toISOString(),
  };
}

export function invalidateSnapshot() { state.cache = null; }

export async function getSnapshot(settings: Settings, refresh = false): Promise<Snapshot> {
  if (refresh && !isDemo()) { await syncNow(); state.cache = null; }
  const ttl = isDemo() ? DEMO_RESET_MIN * 60_000 : SNAPSHOT_TTL_MS;
  if (state.cache && Date.now() - state.cache.at < ttl) return state.cache.data;
  if (!state.inflight) {
    state.inflight = loadSnapshot(settings)
      .then(data => { state.cache = { at: Date.now(), data }; return data; })
      .finally(() => { state.inflight = null; });
  }
  return state.inflight;
}

// PATCH in demo mode: the edit is kept for that visitor only and laid over the shared made-up data.
const demoEdits = demoState<Record<string, Partial<RawTx>>>('edits');

export async function editDemoTransaction(id: string, fields: Record<string, unknown>, visitor: string) {
  if (!(await getSnapshot(getSettings(visitor))).rawTrans.some(r => r.id === id)) throw new Error('Transaction not found');
  const edits = { ...demoEdits.get(visitor) };
  if (!edits[id] && Object.keys(edits).length >= 200) throw new Error('Too many demo edits');
  edits[id] = { ...edits[id], ...fields, ...(typeof fields.notes === 'string' ? { notes: fields.notes.slice(0, 120) } : {}) };
  demoEdits.set(visitor, edits);
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export async function buildOverview(refresh = false, visitor?: string): Promise<OverviewData> {
  const settings = getSettings(visitor);
  const snap = await getSnapshot(settings, refresh);
  const edits = demoEdits.get(visitor);
  const rawTrans = edits ? snap.rawTrans.map(t => (edits[t.id] ? { ...t, ...edits[t.id] } : t)) : snap.rawTrans;

  const accountName = new Map(snap.accounts.map(a => [a.id, a.name]));
  const categoryName = new Map(snap.categories.map(c => [c.id, c.name]));
  const payeeName = new Map(snap.payees.map(p => [p.id, p.name]));
  const groupName = new Map(snap.groups.map(g => [g.id, g.name]));
  const incomeCategories = new Set(snap.categories.filter(c => c.is_income).map(c => c.id));

  // Excluded from KPIs: off-budget accounts, EXCLUDED_ACCOUNTS (name or id), transfers, starting balances.
  // A transfer to an off-budget account carries a category (a mortgage payment, say) and counts, as in Actual.
  const excludedAccountIds = new Set(
    snap.accounts
      .filter(a => a.offbudget || settings.excludedAccounts.includes(a.id) || settings.excludedAccounts.includes(a.name.toLowerCase()))
      .map(a => a.id),
  );
  const transferPayees = new Set(snap.payees.filter(p => p.transfer_acct).map(p => p.id));
  // EXCLUDED_CATEGORIES (name or id): money set aside rather than spent, e.g. savings or investment contributions.
  const excludedCategoryIds = new Set(
    snap.categories
      .filter(c => settings.excludedCategories.includes(c.id) || settings.excludedCategories.includes(c.name.toLowerCase()))
      .map(c => c.id),
  );
  const isExcludedRow = (t: RawTx) => excludedAccountIds.has(t.account) || (!!t.category && excludedCategoryIds.has(t.category));
  const isTransfer = (t: RawTx) => !t.category && (!!t.transfer_id || (!!t.payee && transferPayees.has(t.payee)));
  const isIncome = (t: RawTx) => (t.category ? incomeCategories.has(t.category) : t.amount > 0);
  const counted = (t: RawTx) => !isExcludedRow(t) && !isTransfer(t) && !t.starting_balance_flag;

  const map = (t: RawTx): OverviewTransaction => ({
    id: t.id,
    date: t.date,
    amount: t.amount / 100,
    payee: (t.payee && payeeName.get(t.payee)) || 'Unknown payee',
    payeeId: t.payee || undefined,
    category: (t.category && categoryName.get(t.category)) || 'Uncategorized',
    categoryId: t.category || undefined,
    notes: t.notes || '',
    account: accountName.get(t.account) || t.account,
    isExcluded: isExcludedRow(t) || isTransfer(t),
    counted: counted(t),
    income: isIncome(t),
  });

  const now = new Date();
  const monthKeys = Array.from({ length: 12 }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)));
  const currentMonth = monthKeys[11];
  const windowTrans = rawTrans.filter(t => t.date >= `${monthKeys[0]}-01`);
  const kpiTrans = windowTrans.filter(counted).map(map);

  const months = monthKeys.map(k => {
    const cats: Record<string, number> = {};
    let inc = 0, exp = 0;
    for (const t of kpiTrans) {
      if (!t.date.startsWith(k)) continue;
      if (t.income) { inc += t.amount; continue; }
      exp -= t.amount;
      cats[t.category] = (cats[t.category] || 0) - t.amount;
    }
    return { key: k, income: inc, expense: exp, categories: cats };
  });

  const year = now.getFullYear();
  const fullMonthsYTD = Math.max(now.getMonth(), 1);
  const ytdFull = kpiTrans.filter(t => t.date.startsWith(`${year}`) && t.date < `${currentMonth}-01`);
  const sum = (ts: OverviewTransaction[], income: boolean) => ts.filter(t => !!t.income === income).reduce((a, t) => a + t.amount, 0);
  const averages = {
    ytdIncome: sum(ytdFull, true) / fullMonthsYTD,
    ytdExpense: -sum(ytdFull, false) / fullMonthsYTD,
    ltmIncome: sum(kpiTrans, true) / 12,
    ltmExpense: -sum(kpiTrans, false) / 12,
  };

  const categoryGroup: Record<string, string> = {};
  for (const c of snap.categories) categoryGroup[c.name] = groupName.get(c.group_id) || 'Other';

  // The list keeps excluded-account rows and transfers (greyed out); only starting balances are dropped.
  const transactions = windowTrans.filter(t => !t.starting_balance_flag).map(map).sort((a, b) => b.date.localeCompare(a.date));

  return {
    currentMonth,
    months,
    averages,
    categoryGroup,
    transactions,
    metadata: {
      updated: snap.updated,
      allCategories: snap.categories.map(c => ({ id: c.id, name: c.name })),
      allPayees: snap.payees.filter(p => !p.transfer_acct).map(p => ({ id: p.id, name: p.name })),
    },
    settings: {
      actualUrl: settings.actualUrl,
      hiddenTags: settings.hiddenTags,
      locale: settings.locale,
      currency: settings.currency,
      demo: isDemo(),
    },
  };
}
