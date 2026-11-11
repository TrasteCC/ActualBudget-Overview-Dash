'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Check, Loader2, RotateCcw, Save } from 'lucide-react';
import { makeFmt } from '@/lib/format';
import type { EditableSettings } from '@/lib/server/settings';

interface State {
  settings: EditableSettings;
  defaults: EditableSettings;
  overridden: (keyof EditableSettings)[];
  accounts: { id: string; name: string; offbudget: boolean }[];
  categories: { id: string; name: string }[];
  accountsError: string | null;
  demo: boolean;
}

interface Form {
  excluded: string[]; // account ids
  excludedCats: string[]; // category ids
  hiddenTags: string;
  locale: string;
  currency: string;
  historySince: string;
  syncIntervalMin: string;
}

const panel = 'bg-[#111823] border border-[#1e2835] rounded-xl';
const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-400';
const input = `w-full h-9 px-3 rounded-[9px] bg-[#0e141d] border border-[#1e2835] text-[13px] text-[#e6ebf2] placeholder:text-[#66738a] disabled:opacity-60 ${focus}`;

// Settings are stored as names or ids (env accepts both); the form works with ids.
function toForm(s: State): Form {
  const ex = s.settings.excludedAccounts;
  const exCats = s.settings.excludedCategories;
  return {
    excluded: s.accounts.filter(a => !a.offbudget && (ex.includes(a.id.toLowerCase()) || ex.includes(a.name.toLowerCase()))).map(a => a.id),
    excludedCats: s.categories.filter(c => exCats.includes(c.id.toLowerCase()) || exCats.includes(c.name.toLowerCase())).map(c => c.id),
    hiddenTags: s.settings.hiddenTags.join(', '),
    locale: s.settings.locale,
    currency: s.settings.currency,
    historySince: s.settings.historySince,
    syncIntervalMin: String(s.settings.syncIntervalMin),
  };
}

function preview(locale: string, currency: string): string | null {
  try { return makeFmt(locale, currency).money(-1234.56); } catch { return null; }
}

export default function SettingsPage() {
  const [state, setState] = useState<State | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const apply = useCallback((s: State) => { setState(s); setForm(toForm(s)); }, []);

  const call = useCallback(async (method: 'GET' | 'PUT' | 'DELETE', body?: unknown) => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/settings', {
        method,
        cache: 'no-store',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      apply(json);
      if (method !== 'GET') setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }, [apply]);

  useEffect(() => {
    const t = setTimeout(() => { void call('GET'); }, 0);
    return () => clearTimeout(t);
  }, [call]);

  const sample = useMemo(() => (form ? preview(form.locale, form.currency) : null), [form]);

  if (!state || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {error ? <p className="flex items-center gap-2 text-sm text-rose-300"><AlertCircle className="w-4 h-4" /> {error}</p> : <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />}
      </div>
    );
  }

  const set = (patch: Partial<Form>) => { setForm({ ...form, ...patch }); setSaved(false); };
  const hint = (k: keyof EditableSettings, shown: string) =>
    state.overridden.includes(k) ? <span className="text-[11px] text-amber-300/80">Overrides env default: {shown || '(none)'}</span> : <span className="text-[11px] text-[#66738a]">Default from env</span>;
  const d = state.defaults;

  const save = () => call('PUT', {
    excludedAccounts: form.excluded,
    excludedCategories: form.excludedCats,
    hiddenTags: form.hiddenTags,
    locale: form.locale,
    currency: form.currency,
    historySince: form.historySince,
    syncIntervalMin: Number(form.syncIntervalMin),
  });

  return (
    <main className="min-h-screen px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-2xl flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className={`flex items-center gap-1.5 rounded text-xs font-semibold text-[#8a96a8] hover:text-white transition-colors ${focus}`}>
            <ArrowLeft className="w-4 h-4" /> Overview
          </Link>
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>

        {state.demo && (
          <p className="rounded-lg border border-amber-400/30 bg-amber-400/[0.07] px-3 py-2 text-xs text-amber-200">
            Demo: your changes are only visible to you and reset after 30 minutes. On your own install they are saved to <code>/data/settings.json</code>.
          </p>
        )}

        <section className={`${panel} p-4 flex flex-col gap-3`}>
          <div>
            <h2 className="text-[13px] font-semibold">Accounts left out of the KPIs</h2>
            <p className="text-xs text-[#8a96a8]">Their transactions still show in the list, greyed out. Transfers between accounts never count.</p>
          </div>
          <div className="flex flex-col gap-1">
            {state.accounts.map(a => {
              const checked = a.offbudget || form.excluded.includes(a.id);
              return (
                <label key={a.id} className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] ${a.offbudget ? 'opacity-70' : 'hover:bg-white/[0.04] cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={a.offbudget}
                    onChange={e => set({ excluded: e.target.checked ? [...form.excluded, a.id] : form.excluded.filter(id => id !== a.id) })}
                    className="w-4 h-4 accent-blue-500"
                  />
                  <span className="flex-1">{a.name}</span>
                  {a.offbudget && <span className="text-[11px] text-[#75829a]">off-budget · always excluded</span>}
                </label>
              );
            })}
          </div>
          {state.accountsError && <p className="text-xs text-rose-300">Could not load the accounts from Actual: {state.accountsError}</p>}
          {hint('excludedAccounts', d.excludedAccounts.join(', '))}
        </section>

        <section className={`${panel} p-4 flex flex-col gap-3`}>
          <div>
            <h2 className="text-[13px] font-semibold">Categories left out of the KPIs</h2>
            <p className="text-xs text-[#8a96a8]">For money set aside rather than spent, like savings or investment contributions. Their transactions still show in the list, greyed out.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-3 gap-y-1">
            {state.categories.map(c => (
              <label key={c.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-white/[0.04] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.excludedCats.includes(c.id)}
                  onChange={e => set({ excludedCats: e.target.checked ? [...form.excludedCats, c.id] : form.excludedCats.filter(id => id !== c.id) })}
                  className="w-4 h-4 accent-blue-500"
                />
                <span className="flex-1">{c.name}</span>
              </label>
            ))}
          </div>
          {hint('excludedCategories', d.excludedCategories.join(', '))}
        </section>

        <section className={`${panel} p-4`}>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Hidden tags</span>
            <input className={input} value={form.hiddenTags} onChange={e => set({ hiddenTags: e.target.value })} placeholder="#auto, #imported" />
            <span className="text-xs text-[#8a96a8]">Comma-separated. Kept out of the tag strip (automation markers).</span>
            {hint('hiddenTags', d.hiddenTags.join(', '))}
          </label>
        </section>

        <section className={`${panel} p-4 grid sm:grid-cols-2 gap-4`}>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Locale</span>
            <input className={input} value={form.locale} onChange={e => set({ locale: e.target.value })} placeholder="en-US" />
            {hint('locale', d.locale)}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Currency</span>
            <input className={input} value={form.currency} onChange={e => set({ currency: e.target.value })} placeholder="EUR" maxLength={3} />
            {hint('currency', d.currency)}
          </label>
          <p className="sm:col-span-2 text-xs text-[#8a96a8]">
            Preview: <span className="font-mono tabular-nums text-[#e6ebf2]">{sample ?? 'invalid locale or currency'}</span>
          </p>
        </section>

        <section className={`${panel} p-4 grid sm:grid-cols-2 gap-4`}>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Load history from</span>
            <input type="date" className={input} value={form.historySince} onChange={e => set({ historySince: e.target.value })} />
            <span className="text-xs text-[#8a96a8]">Earliest date read from the budget.</span>
            {hint('historySince', d.historySince)}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Sync every (minutes)</span>
            <input type="number" min={1} max={1440} className={input} value={form.syncIntervalMin} onChange={e => set({ syncIntervalMin: e.target.value })} />
            <span className="text-xs text-[#8a96a8]">The refresh button always syncs immediately.</span>
            {hint('syncIntervalMin', String(d.syncIntervalMin))}
          </label>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className={`flex items-center gap-2 h-9 px-4 rounded-[9px] bg-blue-500/20 border border-blue-500/40 text-xs font-semibold text-blue-100 hover:bg-blue-500/30 disabled:opacity-50 transition-colors ${focus}`}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
          </button>
          <button
            type="button"
            onClick={() => call('DELETE')}
            disabled={busy || state.overridden.length === 0}
            className={`flex items-center gap-2 h-9 px-4 rounded-[9px] bg-[#111823] border border-[#1e2835] text-xs font-semibold text-[#c9d2de] hover:bg-white/[0.04] disabled:opacity-50 transition-colors ${focus}`}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset to defaults
          </button>
          {saved && <span className="flex items-center gap-1.5 text-xs text-emerald-300"><Check className="w-4 h-4" /> Saved — the overview uses it now</span>}
          {error && <span className="flex items-center gap-1.5 text-xs text-rose-300"><AlertCircle className="w-4 h-4" /> {error}</span>}
        </div>
      </div>
    </main>
  );
}
