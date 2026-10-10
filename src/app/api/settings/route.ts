import { NextRequest, NextResponse } from 'next/server';
import { rescheduleSync } from '@/lib/server/actual';
import { getSnapshot, invalidateSnapshot } from '@/lib/server/overview';
import { EDITABLE, envSettings, getSettings, InvalidSetting, isDemo, overriddenKeys, resetSettings, saveSettings, Settings } from '@/lib/server/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const editable = (s: Settings) => Object.fromEntries(EDITABLE.map(k => [k, s[k]]));

async function state() {
  const snap = await getSnapshot(getSettings());
  return {
    settings: editable(getSettings()),
    defaults: editable(envSettings()),
    overridden: overriddenKeys(),
    accounts: snap.accounts.filter(a => !a.closed).map(a => ({ id: a.id, name: a.name, offbudget: a.offbudget })),
    demo: isDemo(),
  };
}

const fail = (err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  return NextResponse.json({ error: message }, { status: err instanceof InvalidSetting ? 400 : 500 });
};

// Saving or resetting drops the cached snapshot and restarts the sync countdown, so it applies at once.
function applied() {
  invalidateSnapshot();
  rescheduleSync();
}

export async function GET() {
  try { return NextResponse.json(await state()); } catch (err) { return fail(err); }
}

export async function PUT(request: NextRequest) {
  try {
    saveSettings(await request.json());
    applied();
    return NextResponse.json(await state());
  } catch (err) { return fail(err); }
}

export async function DELETE() {
  try {
    resetSettings();
    applied();
    return NextResponse.json(await state());
  } catch (err) { return fail(err); }
}
