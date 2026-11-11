'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { EditTransactionModal } from '@/components/edit-transaction-modal';
import { OverviewWorkspace, OverviewData, OverviewTransaction } from '@/components/overview-workspace';

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<OverviewTransaction | null>(null);

  // One request loads everything the Overview filters client-side.
  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/overview${refresh ? '?refresh=1' : ''}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(t);
  }, [load]);

  const handleSave = async (id: string, updates: Record<string, unknown>) => {
    const res = await fetch('/api/overview', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    if (!res.ok) throw new Error('Failed to update transaction');
    await load();
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0e15] flex items-center justify-center">
        {error ? (
          <div className="flex flex-col items-center gap-3 max-w-md text-center px-6">
            <AlertCircle className="w-6 h-6 text-rose-400" />
            <p className="text-sm text-rose-200">Could not load data from Actual Budget.</p>
            <p className="text-xs text-[#8a96a8] break-all">{error}</p>
            <button onClick={() => load(true)} className="mt-1 px-3 py-1.5 rounded-lg bg-[#111823] border border-[#1e2835] text-xs font-semibold text-white hover:bg-white/5 transition-colors">Retry</button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
            <span className="text-sm text-[#8a96a8]">Syncing with Actual Budget…</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2a1219] border border-rose-500/30 text-rose-200 text-xs shadow-lg max-w-[90vw]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="truncate">Could not refresh from Actual Budget — showing the last loaded data. {error}</span>
          <button onClick={() => load(true)} className="font-bold uppercase tracking-wide hover:text-white">Retry</button>
        </div>
      )}
      <OverviewWorkspace data={data} onRefresh={() => load(true)} refreshing={loading} onEdit={setEditing} />
      <EditTransactionModal
        key={editing?.id ?? 'none'}
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        transaction={editing}
        metadata={data.metadata}
        onSave={handleSave}
      />
    </>
  );
}
