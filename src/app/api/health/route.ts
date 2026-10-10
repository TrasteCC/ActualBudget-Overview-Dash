import { NextResponse } from 'next/server';
import { getActual } from '@/lib/server/actual';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Unauthenticated liveness probe for Docker. "budget: true" once the budget is open.
export async function GET() {
  try {
    await getActual();
    return NextResponse.json({ ok: true, budget: true });
  } catch (err) {
    return NextResponse.json({ ok: true, budget: false, error: err instanceof Error ? err.message : String(err) }, { status: 503 });
  }
}
