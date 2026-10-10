import { NextRequest, NextResponse } from 'next/server';
import { gzipSync } from 'node:zlib';
import { buildOverview, editDemoTransaction, invalidateSnapshot } from '@/lib/server/overview';
import { getActual } from '@/lib/server/actual';
import { isDemo } from '@/lib/server/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const refresh = request.nextUrl.searchParams.get('refresh') === '1';
    const body = JSON.stringify(await buildOverview(refresh));
    // ~1 MB of JSON; route handlers are not compressed by Next, so gzip here (~10x smaller).
    if (request.headers.get('accept-encoding')?.includes('gzip')) {
      return new NextResponse(new Uint8Array(gzipSync(body)), {
        headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding' },
      });
    }
    return new NextResponse(body, { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[overview]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Edit one transaction in Actual (category, payee, notes, amount, date).
export async function PATCH(request: NextRequest) {
  try {
    const { id, category, payee, notes, amount, date } = await request.json();
    if (!id || typeof id !== 'string') return NextResponse.json({ error: 'Transaction id is required' }, { status: 400 });
    const fields: Record<string, unknown> = {};
    if (category) fields.category = category;
    if (payee) fields.payee = payee;
    if (notes !== undefined) fields.notes = notes;
    if (typeof amount === 'number' && Number.isFinite(amount)) fields.amount = Math.round(amount * 100);
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) fields.date = date;
    if (isDemo()) {
      await editDemoTransaction(id, fields);
    } else {
      const api = await getActual();
      await api.updateTransaction(id, fields);
      invalidateSnapshot();
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
