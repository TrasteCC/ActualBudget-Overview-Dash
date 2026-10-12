import { NextRequest, NextResponse } from 'next/server';
import { demoVisitor } from '@/lib/server/demo-state';
import { buildOverview } from '@/lib/server/overview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const r2 = (v: number) => Math.round(v * 100) / 100;

// Current-month figures for other dashboards (a few hundred bytes instead of the full Overview).
export async function GET(request: NextRequest) {
  try {
    const d = await buildOverview(false, demoVisitor(request));
    const m = d.months.find(x => x.key === d.currentMonth)!;
    return NextResponse.json({
      month: d.currentMonth,
      income: r2(m.income),
      expense: r2(m.expense),
      net: r2(m.income - m.expense),
      averages: Object.fromEntries(Object.entries(d.averages).map(([k, v]) => [k, r2(v)])),
      currency: d.settings.currency,
      updated: d.metadata.updated,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
