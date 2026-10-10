'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      if (res.ok) { router.push('/'); router.refresh(); } else { setError(true); setPassword(''); }
    } catch { setError(true); } finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 bg-[#0a0e15]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-[#111823] border border-[#1e2835] flex items-center justify-center">
          <Lock className="w-7 h-7 text-[#9aa6b6]" />
        </div>
        <h1 className="text-lg font-semibold">Actual Budget · Overview</h1>
      </div>
      <form onSubmit={submit} className="flex w-80 items-center rounded-full bg-[#111823] border border-[#1e2835] p-1.5">
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="flex-1 bg-transparent px-4 text-sm text-white placeholder:text-[#66738a] focus:outline-none"
        />
        <button type="submit" disabled={loading || !password} className="w-9 h-9 rounded-full bg-blue-500/20 text-blue-200 flex items-center justify-center hover:bg-blue-500/30 disabled:opacity-40 transition-colors">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
        </button>
      </form>
      {error && <p className="flex items-center gap-2 text-xs text-rose-300"><AlertCircle className="w-4 h-4" /> Wrong password</p>}
    </main>
  );
}
