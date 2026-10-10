import { NextResponse } from 'next/server';
import { getActual } from '../../../lib/actual.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  const t0 = Date.now();
  const api = await getActual();
  const r = await api.runQuery(api.q('transactions').filter({ date: { $gte: '2020-01-01' } }).select(['id','date','amount','category','payee']));
  return NextResponse.json({ rows: r.data.length, ms: Date.now() - t0, pid: process.pid });
}
