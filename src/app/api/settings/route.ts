import { NextRequest, NextResponse } from 'next/server';
import { rescheduleSync } from '@/lib/server/actual';
import { claimVisitor, demoVisitor, withVisitor } from '@/lib/server/demo-state';
import { getSnapshot, invalidateSnapshot } from '@/lib/server/overview';
import { EDITABLE, envSettings, getSettings, InvalidSetting, isDemo, overriddenKeys, resetSettings, saveSettings, Settings } from '@/lib/server/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const editable = (s: Settings) => Object.fromEntries(EDITABLE.map(k => [k, s[k]]));

// The settings stay editable when Actual is unreachable; only the account list needs the budget.
async function state(visitor?: string) {
  let accountsError: string | null = null;
  const snap = await getSnapshot(getSettings(visitor)).catch(err => { accountsError = err instanceof Error ? err.message : String(err); return null; });
  return {
    settings: editable(getSettings(visitor)),
    defaults: editable(envSettings()),
    overridden: overriddenKeys(visitor),
    accounts: (snap?.accounts || []).filter(a => !a.closed).map(a => ({ id: a.id, name: a.name, offbudget: a.offbudget })),
    categories: (snap?.categories || []).filter(c => !c.is_income).map(c => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name)),
    accountsError,
    demo: isDemo(),
  };
}

const fail = (err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  return NextResponse.json({ error: message }, { status: err instanceof InvalidSetting ? 400 : 500 });
};

// Saving or resetting drops the cached snapshot and restarts the sync countdown, so it applies at once.
// The demo snapshot does not depend on settings, so there is nothing to rebuild.
function applied() {
  if (!isDemo()) invalidateSnapshot();
  rescheduleSync();
}

export async function GET(request: NextRequest) {
  try { return NextResponse.json(await state(demoVisitor(request))); } catch (err) { return fail(err); }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Expected a JSON object' }, { status: 400 });
    const visitor = claimVisitor(request);
    saveSettings(body, visitor);
    applied();
    return withVisitor(NextResponse.json(await state(visitor)), visitor);
  } catch (err) { return fail(err); }
}

export async function DELETE(request: NextRequest) {
  try {
    const visitor = demoVisitor(request);
    resetSettings(visitor);
    applied();
    return NextResponse.json(await state(visitor));
  } catch (err) { return fail(err); }
}
