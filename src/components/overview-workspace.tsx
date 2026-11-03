'use client';

import React, { memo, useCallback, useDeferredValue, useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Pencil, RefreshCw, Search, Settings as SettingsIcon, X } from 'lucide-react';
import { makeFmt, Fmt } from '@/lib/format';
import type { OverviewData, OverviewTransaction } from '@/lib/server/overview';

export type { OverviewData, OverviewTransaction };

// All filtering is client-side over one payload from /api/overview, so clicks never wait on the
// network. Interaction feedback is CSS-only (colors/opacity/width transitions): no chart library.

interface Props {
    data: OverviewData;
    onRefresh: () => void;
    refreshing: boolean;
    onEdit: (t: OverviewTransaction) => void;
}

type Kind = 'exp' | 'inc' | 'all';

const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PALETTE = ['#60a5fa', '#34d399', '#f5b454', '#fb7185', '#a78bfa', '#22d3ee', '#f472b6'];
const TAG_PALETTE = ['#f59e0b', '#38bdf8', '#a3e635', '#e879f9', '#fb923c', '#2dd4bf', '#f87171', '#818cf8'];
const TAG_RE = /#[\p{L}\p{N}_-]+/gu;
// Actual Budget tags live in the notes as #word. HIDDEN_TAGS (settings) keeps automation markers out.
const tagsOf = (notes: string | undefined, hidden: Set<string>) => (notes ? Array.from(new Set((notes.toLowerCase().match(TAG_RE) || []))).filter(g => !hidden.has(g)) : []);
const OTHER = '#94a3b8';
const INC = '#34d399';
const EXP = '#fb7185';
const NET = '#60a5fa';
const ASIDE = '#a78bfa'; // money set aside (excluded categories)
const WITHDRAWN = '#fbbf24'; // money taken back out of savings
const PAGE = 200;

const signed = (v: number, f: (n: number) => string) => (v >= 0 ? '+' : '') + f(v);
const mShort = (k: string) => MN[+k.slice(5) - 1];
const mLong = (k: string) => `${MN[+k.slice(5) - 1]} ${k.slice(0, 4)}`;
const dayLabel = (d: string) => `${+d.slice(8)} ${MN[+d.slice(5, 7) - 1]}`;

// Shared class fragments
const panel = 'bg-[#111823] border border-[#1e2835] rounded-xl';
const hover = 'transition-colors duration-150 hover:bg-white/[0.04] touch-manipulation';
const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-400';
const label = 'text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#66738a]';
const num = 'font-mono tabular-nums';

export function OverviewWorkspace({ data, onRefresh, refreshing, onEdit }: Props) {
    const F = useMemo(() => makeFmt(data.settings.locale, data.settings.currency), [data.settings.locale, data.settings.currency]);
    const { money: eur, money0: eur0, short } = F;
    const hiddenTags = useMemo(() => new Set(data.settings.hiddenTags), [data.settings.hiddenTags]);
    const [month, setMonth] = useState<string | null>(null);
    const [cat, setCat] = useState<string | null>(null);
    const [group, setGroup] = useState<string | null>(null);
    const [tag, setTag] = useState<string | null>(null);
    const [kind, setKind] = useState<Kind>('exp');
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<'date' | 'amount'>('date');
    const [limit, setLimit] = useState(PAGE);
    const q = useDeferredValue(query.trim().toLowerCase());
    // Tags are parsed once per payload.
    const txTags = useMemo(() => new Map(data.transactions.map(t => [t.id, tagsOf(t.notes, hiddenTags)])), [data.transactions, hiddenTags]);
    const hasTag = useCallback((t: OverviewTransaction, g: string) => (txTags.get(t.id) || []).includes(g), [txTags]);

    // A selected category/group scopes the month totals and KPIs too, rebuilt from the counted
    // transactions with the same rules as the server (income/expense split, averages).
    const scoped = useMemo(() => {
        if (!cat && !group && !tag) return { months: data.months, averages: data.averages };
        const match = (t: OverviewTransaction) =>
            (!cat || t.category === cat) && (!group || (data.categoryGroup[t.category] || 'Other') === group) && (!tag || hasTag(t, tag));
        // A tag also rebuilds the per-category split (so "Where the money goes" shows only tagged spend);
        // a category/group keeps the full split so the other categories stay pickable.
        const by = new Map(data.months.map(m => [m.key, { ...m, income: 0, expense: 0, categories: tag ? {} as Record<string, number> : m.categories }]));
        for (const t of data.transactions) {
            if (!t.counted) continue;
            const m = by.get(t.date.slice(0, 7));
            if (!m) continue;
            if (tag && !t.income && hasTag(t, tag)) m.categories[t.category] = (m.categories[t.category] || 0) - t.amount;
            if (!match(t)) continue;
            if (t.income) { m.income += t.amount; continue; }
            m.expense -= t.amount;
        }
        const months = data.months.map(m => by.get(m.key)!);
        const cur = data.currentMonth;
        const ytd = months.filter(m => m.key.startsWith(cur.slice(0, 4)) && m.key < cur);
        const div = Math.max(+cur.slice(5) - 1, 1);
        const total = (ms: typeof months, f: 'income' | 'expense') => ms.reduce((a, m) => a + m[f], 0);
        return {
            months,
            averages: {
                ytdIncome: total(ytd, 'income') / div,
                ytdExpense: total(ytd, 'expense') / div,
                ltmIncome: total(months, 'income') / 12,
                ltmExpense: total(months, 'expense') / 12,
            },
        };
    }, [data, cat, group, tag, hasTag]);
    const scopeLabel = [tag && `#${tag.slice(1)}`, cat || group].filter(Boolean).join(' · ');

    const km = month || data.currentMonth;
    const mi = scoped.months.find(m => m.key === km) || scoped.months[scoped.months.length - 1];

    const pickMonth = (k: string | null) => { setMonth(prev => (prev === k ? null : k)); setLimit(PAGE); };
    const pickCat = useCallback((c: string | null) => { setCat(prev => (prev === c ? null : c)); setGroup(null); setLimit(PAGE); }, []);
    const pickPayee = useCallback((p: string) => { setQuery(p); setLimit(PAGE); }, []);
    const showMore = useCallback(() => setLimit(l => l + PAGE), []);
    const changeKind = useCallback((k: Kind) => { setKind(k); setLimit(PAGE); }, []);
    const pickGroup = (g: string | null) => { setGroup(prev => (prev === g ? null : g)); setCat(null); setLimit(PAGE); };
    const pickTag = (g: string | null) => { setTag(prev => (prev === g ? null : g)); setLimit(PAGE); };
    const clearAll = () => { setMonth(null); setCat(null); setGroup(null); setTag(null); setQuery(''); setKind('exp'); setLimit(PAGE); };

    // Category ranking + colors for the KPI month
    const catView = useMemo(() => {
        // Refunds net into their category, so a category can end the month at zero or below. The header
        // keeps the net total (it matches the Expenses KPI); shares and bars use the positive spend only.
        const entries = Object.entries(mi.categories).filter(([, v]) => Math.abs(v) >= 0.005).sort((a, b) => b[1] - a[1]);
        const total = entries.reduce((a, [, v]) => a + v, 0);
        const gross = entries.reduce((a, [, v]) => a + Math.max(v, 0), 0) || 1;
        const color: Record<string, string> = {};
        entries.forEach(([c], i) => { color[c] = PALETTE[i] ?? OTHER; });
        const groups = new Map<string, number>();
        for (const [c, v] of entries) {
            const g = data.categoryGroup[c] || 'Other';
            groups.set(g, (groups.get(g) || 0) + v);
        }
        return {
            entries, total, gross, color,
            spend: entries.filter(([, v]) => v > 0),
            max: entries[0]?.[1] || 1,
            groups: Array.from(groups.entries()).sort((a, b) => b[1] - a[1]),
            spark: Object.fromEntries(entries.map(([c]) => {
                const s = data.months.map(m => m.categories[c] || 0);
                return [c, { s, max: Math.max(...s, 1) }];
            })),
        };
    }, [mi, data.months, data.categoryGroup]);

    const monthScale = useMemo(() => {
        const vals = scoped.months.flatMap(m => [m.income, m.expense]).sort((a, b) => b - a);
        const cap = (vals[1] || vals[0] || 1) * 1.12; // one-off income spikes don't flatten every other month
        return { cap, maxExp: Math.max(...scoped.months.map(m => m.expense), 1) };
    }, [scoped.months]);

    const filtered = useMemo(() => {
        let tx = data.transactions.filter(t =>
            (!month || t.date.startsWith(month)) &&
            (kind === 'all' || (kind === 'exp') !== !!t.income) &&
            (!cat || t.category === cat) &&
            (!group || (data.categoryGroup[t.category] || 'Other') === group) &&
            (!tag || hasTag(t, tag)) &&
            (!q || t.payee?.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q)));
        if (sort === 'amount') tx = [...tx].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
        const counted = tx.filter(t => !t.isExcluded);
        return { tx, sum: counted.reduce((a, t) => a + t.amount, 0) };
    }, [data.transactions, data.categoryGroup, month, kind, cat, group, tag, hasTag, q, sort]);

    // Tag ranking for the active period (selected month, else the 12 months), counted expenses only.
    // Independent of the tag filter itself so every tag stays pickable.
    const tagView = useMemo(() => {
        const sums = new Map<string, number>();
        for (const t of data.transactions) {
            if (!t.counted || t.income || (month && !t.date.startsWith(month))) continue;
            for (const g of txTags.get(t.id) || []) sums.set(g, (sums.get(g) || 0) - t.amount);
        }
        // A fully refunded tag nets to zero or below: leave it out so the shares stay within 0–100%.
        const entries = Array.from(sums.entries()).filter(([, v]) => v >= 0.005).sort((a, b) => b[1] - a[1]);
        const total = entries.reduce((a, [, v]) => a + v, 0);
        return { entries, total, color: Object.fromEntries(entries.map(([g], i) => [g, TAG_PALETTE[i % TAG_PALETTE.length]])) as Record<string, string> };
    }, [data.transactions, txTags, month]);

    // Selection highlights paint immediately; the (heavier) list catches up as a deferred render.
    const deferred = useDeferredValue(filtered);
    const deferredColors = useDeferredValue(catView.color);
    const deferredPeriod = useDeferredValue(month ? mLong(month) : 'Last 12 months');

    const net = mi.income - mi.expense;
    const rate = mi.income > 0 ? (net / mi.income) * 100 : null;
    const vsAvg = (v: number, base: number) => (base > 0 ? `${signed(Math.round((v / base - 1) * 100), String)}% vs 12m avg` : 'no 12m history');
    // Year to date including the month in progress; same counted-only month totals as the Expenses/Income cards.
    const yearKey = data.currentMonth.slice(0, 4);
    const ytdMonths = scoped.months.filter(m => m.key.startsWith(yearKey) && m.key <= data.currentMonth);
    const ytdExp = ytdMonths.reduce((a, m) => a + m.expense, 0);
    const ytdInc = ytdMonths.reduce((a, m) => a + m.income, 0);
    const ytdSpan = `Jan–${mShort(data.currentMonth)} ${yearKey}`;
    // Money set aside (excluded categories): its own summary column, never part of the KPIs above.
    const aside = data.settings.setAside;
    const ytdAside = data.months.filter(m => m.key.startsWith(yearKey) && m.key <= data.currentMonth).reduce((a, m) => a + m.aside, 0);
    const summaryCols = aside ? 'grid-cols-[56px_minmax(0,1fr)_minmax(0,1fr)_78px_78px_44px]' : 'grid-cols-[56px_minmax(0,1fr)_minmax(0,1fr)_78px_44px]';
    const summaryMin = aside ? 'min-w-[650px]' : 'min-w-[560px]';
    // Three rows of three: the selected month, then expenses, then income.
    const kpis: { label: string; period: string; value: string; color: string; sub: string; active: boolean; onClick: () => void; ytd?: boolean }[] = [
        { label: 'Expenses', period: mLong(km), value: eur(mi.expense), color: EXP, sub: vsAvg(mi.expense, scoped.averages.ltmExpense), active: kind === 'exp' && !!month, onClick: () => { setKind('exp'); setMonth(km); } },
        { label: 'Income', period: mLong(km), value: eur(mi.income), color: INC, sub: vsAvg(mi.income, scoped.averages.ltmIncome), active: kind === 'inc', onClick: () => { setKind('inc'); setMonth(km); } },
        { label: 'Net', period: mLong(km), value: signed(net, eur), color: net >= 0 ? NET : EXP, sub: rate !== null && rate > -100 ? `savings rate ${rate.toFixed(0)}%` : 'month in progress', active: kind === 'all', onClick: () => { setKind('all'); setMonth(km); } },
        { label: 'Total exp.', period: 'YTD', value: eur(ytdExp), color: EXP, sub: ytdSpan, active: false, ytd: true, onClick: () => { setKind('exp'); setMonth(null); } },
        { label: 'Avg expenses', period: 'YTD', value: eur(scoped.averages.ytdExpense), color: '#c9d2de', sub: 'full months this year', active: false, onClick: () => { setKind('exp'); setMonth(null); } },
        { label: 'Avg expenses', period: 'LTM', value: eur(scoped.averages.ltmExpense), color: '#9aa6b6', sub: 'last 12 months', active: false, onClick: () => { setKind('exp'); setMonth(null); } },
        { label: 'Total inc.', period: 'YTD', value: eur(ytdInc), color: INC, sub: ytdSpan, active: false, ytd: true, onClick: () => { setKind('inc'); setMonth(null); } },
        { label: 'Avg income', period: 'YTD', value: eur(scoped.averages.ytdIncome), color: '#c9d2de', sub: 'full months this year', active: false, onClick: () => { setKind('inc'); setMonth(null); } },
        { label: 'Avg income', period: 'LTM', value: eur(scoped.averages.ltmIncome), color: '#9aa6b6', sub: 'last 12 months', active: false, onClick: () => { setKind('inc'); setMonth(null); } },
    ];

    const chips: { label: string; clear: () => void }[] = [];
    if (month) chips.push({ label: mLong(month), clear: () => setMonth(null) });
    if (group) chips.push({ label: group, clear: () => setGroup(null) });
    if (cat) chips.push({ label: cat, clear: () => setCat(null) });
    if (tag) chips.push({ label: `#${tag.slice(1)}`, clear: () => setTag(null) });
    if (query) chips.push({ label: `“${query}”`, clear: () => setQuery('') });

    return (
        <div className="min-h-screen bg-[#0a0e15] text-[#e6ebf2] lg:flex">
            {/* ── Sidebar: views + period + groups (a horizontal strip on mobile) ── */}
            <aside className="lg:sticky lg:top-0 lg:h-screen lg:w-[236px] lg:shrink-0 lg:overflow-y-auto bg-[#0e131c] border-b lg:border-b-0 lg:border-r border-[#1a2230] px-3 py-3 lg:py-5 flex flex-col gap-4 lg:gap-5">
                <div className="shrink-0 flex items-center gap-2 px-2">
                    {data.settings.demo ? (
                        <span className="text-base font-bold">Actual Budget</span>
                    ) : (
                        <a href={data.settings.actualUrl || '#'} target="_blank" rel="noreferrer" className={`flex items-center gap-2 text-base font-bold rounded ${focus} hover:text-blue-300 transition-colors`}>
                            Actual Budget <ExternalLink className="w-3 h-3 text-[#66738a]" />
                        </a>
                    )}
                    <span className={`w-[7px] h-[7px] rounded-full ${data.settings.demo ? 'bg-amber-400' : 'bg-emerald-400'}`} aria-label={data.settings.demo ? 'Demo' : 'Live'} />
                    <Link href="/settings" title="Settings" aria-label="Settings" className={`ml-auto p-1 rounded text-[#66738a] hover:text-white transition-colors ${focus}`}>
                        <SettingsIcon className="w-4 h-4" />
                    </Link>
                </div>

                {(
                    <>
                        <div className="shrink-0 flex flex-col gap-1">
                            <h2 className={`${label} px-2.5 mb-1 hidden lg:block`}>Period</h2>
                            <div className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
                                <button
                                    type="button"
                                    onClick={() => pickMonth(null)}
                                    className={`shrink-0 text-left rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold ${focus} ${hover} ${month ? '' : 'bg-blue-500/15 text-blue-200'}`}
                                >
                                    Last 12 months
                                </button>
                                {[...scoped.months].reverse().map(m => {
                                    const n = m.income - m.expense;
                                    const sel = month === m.key;
                                    return (
                                        <button
                                            key={m.key}
                                            type="button"
                                            onClick={() => pickMonth(m.key)}
                                            aria-pressed={sel}
                                            className={`shrink-0 flex lg:grid lg:grid-cols-[58px_minmax(0,1fr)_56px] items-center gap-2 rounded-lg px-2.5 py-1.5 text-left ${focus} ${hover} ${sel ? 'bg-blue-500/15' : ''}`}
                                        >
                                            <span className="text-[12.5px] text-[#c9d2de] whitespace-nowrap">{mShort(m.key)} <span className="text-[#66738a]">{m.key.slice(2, 4)}</span></span>
                                            <span className="hidden lg:block h-1 rounded bg-[#1a2332]">
                                                <span
                                                    className="block h-1 rounded bg-rose-400 transition-[width,opacity] duration-300"
                                                    style={{ width: `${(Math.max(m.expense, 0) / monthScale.maxExp) * 100}%`, opacity: month && !sel ? 0.35 : 0.9 }}
                                                />
                                            </span>
                                            <span className={`${num} text-right text-[11.5px] font-semibold`} style={{ color: n >= 0 ? NET : EXP }}>{signed(n, short)}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="shrink-0 flex flex-col gap-1">
                            <h2 className={`${label} px-2.5 mb-1 hidden lg:block`}>Groups · {mLong(km)}</h2>
                            <div className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
                                {catView.groups.map(([g, v]) => {
                                    const sel = group === g;
                                    return (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={() => pickGroup(g)}
                                            aria-pressed={sel}
                                            className={`shrink-0 flex flex-col gap-1 rounded-lg px-2.5 py-1.5 text-left ${focus} ${hover} ${sel ? 'bg-blue-500/15' : ''}`}
                                        >
                                            <span className="w-full flex justify-between gap-3 text-[12.5px]">
                                                <span className={`text-[#c9d2de] whitespace-nowrap ${sel ? 'font-bold' : ''}`}>{g}</span>
                                                <span className={`${num} text-[11.5px] text-[#9aa6b6]`}>{eur0(v)}</span>
                                            </span>
                                            <span className="hidden lg:block w-full h-[3px] rounded bg-[#1a2332]">
                                                <span className="block h-[3px] rounded bg-blue-400 transition-[width] duration-300" style={{ width: `${(Math.max(v, 0) / catView.gross) * 100}%` }} />
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </aside>

            <main className="flex-1 min-w-0 flex flex-col gap-3 px-3 sm:px-5 pt-4 pb-32">
                {data.settings.demo && (
                    <p className="rounded-lg border border-amber-400/30 bg-amber-400/[0.07] px-3 py-1.5 text-xs text-amber-200">
                        Demo data — nothing here is real. Your edits and settings are only visible to you and reset after 30 minutes.
                    </p>
                )}
                {/* ── Top bar: search, active filters, refresh ── */}
                <div className="flex flex-wrap items-center gap-2">
                    {(
                        <label className="relative flex items-center flex-1 min-w-0 sm:flex-none sm:w-[340px]">
                            <span className="sr-only">Search notes or payee</span>
                            <Search className="absolute left-3 w-4 h-4 text-[#8a96a8]" />
                            <input
                                type="search"
                                value={query}
                                onChange={e => { setQuery(e.target.value); setLimit(PAGE); }}
                                placeholder="Search notes or payee…"
                                className={`w-full h-9 pl-9 pr-3 rounded-[9px] bg-[#111823] border border-[#1e2835] text-[13px] text-[#e6ebf2] placeholder:text-[#66738a] ${focus}`}
                            />
                        </label>
                    )}
                    {chips.map(c => (
                        <button
                            key={c.label}
                            type="button"
                            onClick={c.clear}
                            aria-label={`Remove filter ${c.label}`}
                            className={`flex items-center gap-1.5 rounded-full border border-[#2c4a74] bg-blue-500/10 pl-3 pr-2 py-1 text-xs font-semibold text-[#bcd6fb] transition-colors duration-150 hover:bg-blue-500/20 touch-manipulation ${focus}`}
                        >
                            {c.label}<X className="w-3 h-3" />
                        </button>
                    ))}
                    {chips.length > 0 && (
                        <button type="button" onClick={clearAll} className={`text-xs text-[#8a96a8] underline hover:text-white transition-colors ${focus}`}>Clear all</button>
                    )}
                    <div className="flex-1" />
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={refreshing}
                        title="Reload from Actual Budget"
                        className={`flex items-center gap-2 h-9 px-3 rounded-[9px] bg-[#111823] border border-[#1e2835] text-xs text-[#8a96a8] ${hover} ${focus} disabled:opacity-60`}
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        <span className={num}>{F.time(data.metadata.updated)}</span>
                    </button>
                </div>

                {(
                    <>
                        {/* ── KPI ticker ── */}
                        <section aria-label="Key figures" className="grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-9 gap-2">
                            {kpis.map((k, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={k.onClick}
                                    className={`flex flex-col items-start gap-0.5 text-left rounded-[10px] border px-3 py-2 ${focus} ${hover} ${k.active ? 'border-blue-500/40 bg-blue-500/10' : k.ytd ? 'border-amber-400/30 bg-amber-400/[0.07]' : 'border-[#1e2835] bg-[#111823]'}`}
                                >
                                    <span className="text-[10.5px] font-semibold text-[#8a96a8] whitespace-nowrap">{k.label} <span className="font-medium text-[#66738a]">· {k.period}</span></span>
                                    <span className={`${num} text-base font-semibold`} style={{ color: k.color }}>{k.value}</span>
                                    <span className="text-[10.5px] text-[#75829a] whitespace-nowrap">{k.sub}</span>
                                </button>
                            ))}
                        </section>

                        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-3">
                            {/* ── Monthly summary: rows are the chart ── */}
                            <section aria-label="Monthly summary" className={`${panel} px-3.5 pt-3 pb-2 overflow-x-auto`}>
                                <div className="flex items-baseline gap-3 mb-1.5">
                                    <h2 className="text-[13px] font-semibold">Monthly summary</h2>
                                    {scopeLabel && <span className="rounded-full border border-[#2c4a74] bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-[#bcd6fb]">{scopeLabel}</span>}
                                    <span className="text-[11.5px] text-[#75829a]">Click a row to filter · again to clear</span>
                                    {aside && (
                                        <span className={`ml-auto ${num} text-[11.5px] text-[#9aa6b6]`} title="Excluded categories (settings), net of withdrawals">
                                            Set aside · YTD <span className="font-semibold" style={{ color: ytdAside < 0 ? WITHDRAWN : ASIDE }}>{signed(ytdAside, eur0)}</span>
                                        </span>
                                    )}
                                </div>
                                <div className={`grid ${summaryCols} gap-2.5 px-2 py-1 ${summaryMin} ${label}`}>
                                    <span>Month</span><span>Income</span><span>Expenses</span><span className="text-right">Net</span>{aside && <span className="text-right">Set aside</span>}<span className="text-right">Rate</span>
                                </div>
                                {scoped.months.map(m => {
                                    const n = m.income - m.expense;
                                    const sel = month === m.key;
                                    const dim = !!month && !sel;
                                    const r = m.income > 0 ? (n / m.income) * 100 : null;
                                    return (
                                        <button
                                            key={m.key}
                                            type="button"
                                            onClick={() => pickMonth(m.key)}
                                            aria-pressed={sel}
                                            className={`w-full ${summaryMin} grid ${summaryCols} gap-2.5 items-center px-2 py-[5px] rounded border-l-2 text-left ${focus} ${hover} ${sel ? 'border-blue-400 bg-blue-500/10' : 'border-transparent'}`}
                                        >
                                            <span className="text-[12.5px] font-semibold text-[#c9d2de]">{mShort(m.key)} <span className="font-normal text-[#66738a]">{m.key.slice(2, 4)}</span></span>
                                            <BarCell value={m.income} scale={monthScale.cap} color={INC} textColor="#9ce5c6" dim={dim} fmt={F} />
                                            <BarCell value={m.expense} scale={monthScale.cap} color={EXP} textColor="#fcb3be" dim={dim} fmt={F} />
                                            <span className={`${num} text-right text-xs font-semibold`} style={{ color: n >= 0 ? NET : EXP }}>{signed(n, eur0)}</span>
                                            {aside && <span className={`${num} text-right text-xs`} style={{ color: Math.abs(m.aside) < 0.5 ? '#66738a' : m.aside < 0 ? WITHDRAWN : ASIDE }}>{Math.abs(m.aside) < 0.5 ? '—' : signed(m.aside, eur0)}</span>}
                                            <span className={`${num} text-right text-[11.5px] text-[#9aa6b6]`}>{r !== null && r > -100 ? `${r.toFixed(0)}%` : '—'}</span>
                                        </button>
                                    );
                                })}
                            </section>

                            {/* ── Where the money goes ── */}
                            <section aria-label="Expenses by category" className={`${panel} px-3.5 pt-3 pb-2 flex flex-col min-h-0 max-h-[440px]`}>
                                <div className="flex items-baseline justify-between mb-2.5">
                                    <h2 className="text-[13px] font-semibold">Where the money goes <span className="font-normal text-[#75829a]">· {mLong(km)}</span></h2>
                                    <span className={`${num} text-[13px] font-semibold text-rose-400`}>{eur(catView.total)}</span>
                                </div>
                                <div role="group" aria-label="Category share" className="flex gap-0.5 h-3.5 mb-2.5">
                                    {catView.spend.slice(0, 7).map(([c, v]) => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => pickCat(c)}
                                            title={`${c} · ${eur(v)}`}
                                            aria-label={c}
                                            className={`h-3.5 rounded-[3px] transition-[opacity,filter] duration-150 hover:brightness-125 touch-manipulation ${focus}`}
                                            style={{ width: `${(v / catView.gross) * 100}%`, background: catView.color[c], opacity: cat && cat !== c ? 0.25 : 1 }}
                                        />
                                    ))}
                                    {catView.spend.length > 7 && (
                                        <span className="h-3.5 rounded-[3px]" style={{ width: `${(catView.spend.slice(7).reduce((a, [, v]) => a + v, 0) / catView.gross) * 100}%`, background: OTHER, opacity: cat ? 0.25 : 1 }} />
                                    )}
                                </div>
                                <div className={`grid grid-cols-[minmax(0,1fr)_96px_44px_90px] gap-2.5 px-1.5 pb-1 ${label}`}>
                                    <span>Category</span><span className="hidden sm:block">12 months</span><span className="text-right">Share</span><span className="text-right">Spent</span>
                                </div>
                                <div className="flex-1 min-h-0 overflow-y-auto">
                                    {catView.entries.length === 0 && <p className="py-6 text-center text-xs text-[#75829a]">No expenses this month.</p>}
                                    {catView.entries.map(([c, v]) => {
                                        const sel = cat === c;
                                        const sp = catView.spark[c];
                                        return (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => pickCat(c)}
                                                aria-pressed={sel}
                                                className={`w-full grid grid-cols-[minmax(0,1fr)_96px_44px_90px] gap-2.5 items-center px-1.5 py-[5px] rounded-md text-left transition-[background-color,opacity] duration-150 ${focus} ${hover} ${sel ? 'bg-blue-500/10' : ''}`}
                                                style={{ opacity: cat && !sel ? 0.45 : 1 }}
                                            >
                                                <span className="flex items-center gap-2 min-w-0">
                                                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: catView.color[c] }} />
                                                    <span className={`text-[12.5px] truncate ${sel ? 'font-bold' : ''}`}>{c}</span>
                                                </span>
                                                <span aria-hidden className="hidden sm:flex items-end gap-0.5 h-[18px]">
                                                    {sp.s.map((x, i) => (
                                                        <span key={i} className="w-1.5 rounded-[1px]" style={{ height: `${Math.max(1, (x / sp.max) * 18)}px`, background: data.months[i].key === km ? catView.color[c] : '#3a4658' }} />
                                                    ))}
                                                </span>
                                                <span className={`${num} text-right text-[11.5px] text-[#9aa6b6]`}>{v > 0 ? `${((v / catView.gross) * 100).toFixed(1)}%` : '–'}</span>
                                                <span className={`${num} text-right text-xs`}>{eur(v)}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        </div>

                        {/* ── Tags: same stacked-bar language as "Where the money goes"; click = filter everything ── */}
                        {tagView.entries.length > 0 && (
                            <section aria-label="Expenses by tag" className={`${panel} px-3.5 pt-2.5 pb-2`}>
                                <div className="flex items-baseline justify-between mb-2">
                                    <h2 className="text-[13px] font-semibold">Tags <span className="font-normal text-[#75829a]">· {month ? mLong(month) : 'Last 12 months'} · click to filter</span></h2>
                                    <span className={`${num} text-[13px] font-semibold text-rose-400`}>{eur(tagView.total)}</span>
                                </div>
                                {/* One row: each block is its share of the total, never narrower than its label; scrolls sideways when the labels overflow. */}
                                <div role="group" aria-label="Tag share" className="flex gap-0.5 overflow-x-auto pb-1.5 [scrollbar-width:thin] [scrollbar-color:#2a3546_transparent]">
                                    {tagView.entries.map(([g, v]) => (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={() => pickTag(g)}
                                            title={`${g} · ${eur(v)} · ${((v / tagView.total) * 100).toFixed(1)}%`}
                                            aria-pressed={tag === g}
                                            className={`h-7 shrink-0 rounded-[4px] px-2 text-left text-[11.5px] font-semibold whitespace-nowrap text-[#0a0e15] transition-[opacity,filter] duration-150 hover:brightness-110 touch-manipulation ${focus} ${tag === g ? 'ring-2 ring-white/80 ring-inset' : ''}`}
                                            style={{ width: `${(v / tagView.total) * 100}%`, minWidth: 'max-content', background: tagView.color[g], opacity: tag && tag !== g ? 0.3 : 1 }}
                                        >
                                            #{g.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}
                    </>
                )}

                {(
                    <TransactionsPanel
                        rows={deferred.tx}
                        sum={deferred.sum}
                        limit={limit}
                        onMore={showMore}
                        periodLabel={deferredPeriod}
                        kind={kind}
                        setKind={changeKind}
                        sort={sort}
                        setSort={setSort}
                        colors={deferredColors}
                        onCategory={pickCat}
                        onPayee={pickPayee}
                        onEdit={onEdit}
                        fmt={F}
                    />
                )}
            </main>
        </div>
    );
}

function BarCell({ value, scale, color, textColor, dim, fmt }: { value: number; scale: number; color: string; textColor: string; dim: boolean; fmt: Fmt }) {
    const clipped = value > scale;
    return (
        <span className="flex items-center gap-1.5 min-w-0">
            <span className="flex-1 h-[7px] rounded-sm bg-[#16202d] overflow-hidden">
                <span
                    className="block h-[7px] rounded-sm transition-[width,opacity] duration-300"
                    style={{ width: `${Math.min(Math.max(value, 0) / scale, 1) * 100}%`, background: color, opacity: dim ? 0.3 : 0.9 }}
                />
            </span>
            <span className={`${num} w-[74px] shrink-0 text-right text-[11.5px] whitespace-nowrap`} style={{ color: textColor }} title={clipped ? 'Bar capped: one-off spike' : undefined}>
                {fmt.money0(value)}
            </span>
        </span>
    );
}

interface PanelProps {
    rows: OverviewTransaction[];
    sum: number;
    limit: number;
    onMore: () => void;
    periodLabel: string;
    kind: Kind;
    setKind: (k: Kind) => void;
    sort: 'date' | 'amount';
    setSort: (s: 'date' | 'amount') => void;
    colors: Record<string, string>;
    onCategory: (c: string) => void;
    onPayee: (p: string) => void;
    onEdit: (t: OverviewTransaction) => void;
    fmt: Fmt;
}

const TransactionsPanel = memo(function TransactionsPanel({ rows, sum, limit, onMore, periodLabel, kind, setKind, sort, setSort, colors, onCategory, onPayee, onEdit, fmt }: PanelProps) {
    const eur = fmt.money;
    const cols = 'grid grid-cols-[52px_minmax(0,1fr)_96px_28px] md:grid-cols-[62px_minmax(0,1.6fr)_minmax(0,1fr)_170px_120px_28px] gap-3';
    return (
        <section aria-label="Transactions" className={`${panel} flex flex-col min-h-[360px]`}>
            <div className="flex flex-wrap items-center gap-3 px-3.5 py-2.5 border-b border-[#1e2835]">
                <h2 className="text-[13px] font-semibold">Transactions <span className="font-normal text-[#75829a]">· {periodLabel}</span></h2>
                <div role="group" aria-label="Type" className="flex gap-0.5 p-0.5 rounded-lg border border-[#1e2835]">
                    {([['exp', 'Expenses'], ['inc', 'Income'], ['all', 'All']] as [Kind, string][]).map(([k, l]) => (
                        <button
                            key={k}
                            type="button"
                            onClick={() => setKind(k)}
                            aria-pressed={kind === k}
                            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors duration-150 touch-manipulation ${focus} ${kind === k ? 'bg-[#1d2a3d] text-[#e6ebf2]' : 'text-[#8a96a8] hover:text-[#c9d2de]'}`}
                        >
                            {l}
                        </button>
                    ))}
                </div>
                <div className="flex-1" />
                <span className="text-xs text-[#8a96a8]">{rows.length} transactions</span>
                <span className={`${num} text-[13px] font-semibold`}>{signed(sum, eur)}</span>
            </div>
            <div className={`${cols} px-3.5 py-1.5 border-b border-[#1a2332] ${label}`}>
                <button type="button" onClick={() => setSort('date')} className={`text-left uppercase transition-colors ${focus} ${sort === 'date' ? 'text-[#e6ebf2]' : 'hover:text-[#c9d2de]'}`}>Date ↓</button>
                <span>Description</span>
                <span className="hidden md:block">Payee</span>
                <span className="hidden md:block">Category</span>
                <button type="button" onClick={() => setSort('amount')} className={`text-right uppercase transition-colors ${focus} ${sort === 'amount' ? 'text-[#e6ebf2]' : 'hover:text-[#c9d2de]'}`}>Amount ↓</button>
                <span />
            </div>
            <div className="flex-1 overflow-y-auto max-h-[520px]">
                {rows.length === 0 && <p className="px-3.5 py-6 text-[12.5px] text-[#8a96a8]">No transactions match these filters.</p>}
                {rows.slice(0, limit).map(t => {
                    const excluded = !!t.isExcluded;
                    const color = excluded ? OTHER : colors[t.category] || '#8391a5';
                    return (
                        <div
                            key={t.id}
                            className={`group ${cols} items-center px-3.5 py-1.5 border-b border-[#161f2c] transition-colors duration-150 hover:bg-white/[0.03]`}
                            style={{ opacity: excluded ? 0.6 : 1 }}
                        >
                            <span className="text-xs text-[#8a96a8]">{dayLabel(t.date)}</span>
                            <span className="min-w-0 flex flex-col">
                                <span className="text-[13px] truncate">{t.notes || t.payee}</span>
                                <button type="button" onClick={() => onCategory(t.category)} className={`md:hidden self-start max-w-full truncate text-[11px] text-[#75829a] ${focus}`}>{t.category}</button>
                            </span>
                            <button type="button" onClick={() => onPayee(t.payee)} className={`hidden md:block text-left truncate text-xs text-[#9aa6b6] hover:text-white transition-colors ${focus}`}>{t.payee}</button>
                            <button
                                type="button"
                                onClick={() => !excluded && onCategory(t.category)}
                                className={`hidden md:flex justify-self-start max-w-full items-center gap-1.5 rounded-md border border-[#1e2835] bg-[#0e141d] px-2 py-0.5 text-[11.5px] text-[#c9d2de] whitespace-nowrap overflow-hidden transition-colors duration-150 hover:border-[#2c4a74] ${focus}`}
                            >
                                <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: color }} />
                                <span className="truncate">{t.category}</span>
                            </button>
                            <span className={`${num} text-right text-[13px] font-semibold`} style={{ color: excluded ? '#8391a5' : t.amount > 0 ? INC : EXP }}>
                                {signed(t.amount, eur)}
                            </span>
                            <button
                                type="button"
                                onClick={() => onEdit(t)}
                                aria-label="Edit transaction"
                                className={`p-1 rounded text-[#66738a] opacity-60 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 hover:text-white ${focus}`}
                            >
                                <Pencil className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    );
                })}
                {rows.length > limit && (
                    <button type="button" onClick={onMore} className={`w-full px-3.5 py-2.5 text-xs font-semibold text-blue-300 ${hover} ${focus}`}>
                        Show {Math.min(PAGE, rows.length - limit)} more of {rows.length - limit} remaining
                    </button>
                )}
            </div>
        </section>
    );
});
