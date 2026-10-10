import * as api from '@actual-app/api';
import fs from 'node:fs';
import { getSettings } from './settings';

// One budget session per process (2026-10-10). @actual-app/api keeps the budget as a local SQLite
// file, so queries are in-process and concurrent requests are safe; only init/download/sync go to
// the network. This replaces the actual-http-api sidecar, which re-opened the budget per request.

export type Actual = typeof api;

// State lives on globalThis: Next bundles every route separately, so module-level variables would
// give each route its own copy (and its own budget session).
interface State { ready: Promise<Actual> | null; timer: NodeJS.Timeout | null; syncing: Promise<void> | null }
const g = globalThis as typeof globalThis & { __abodActual?: State };
const state = (g.__abodActual ??= { ready: null, timer: null, syncing: null });

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export function getActual(): Promise<Actual> {
  if (!state.ready) {
    state.ready = (async () => {
      if (process.env.ACTUAL_INSECURE_TLS === '1') process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      const dataDir = process.env.ACTUAL_DATA_DIR || './data';
      fs.mkdirSync(dataDir, { recursive: true });
      await api.init({ dataDir, serverURL: required('ACTUAL_SERVER_URL'), password: required('ACTUAL_PASSWORD') });
      const e2e = process.env.ACTUAL_E2E_PASSWORD;
      await api.downloadBudget(required('ACTUAL_SYNC_ID'), e2e ? { password: e2e } : undefined);
      scheduleSync();
      return api;
    })().catch(err => { state.ready = null; throw err; });
  }
  return state.ready;
}

// Re-armed from the current settings after every run, so a new interval applies without a restart.
function scheduleSync() {
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    syncNow().catch(err => console.error('[actual] periodic sync failed', err)).finally(scheduleSync);
  }, getSettings().syncIntervalMin * 60_000);
  state.timer.unref?.();
}

// Called after the settings page saves: restart the countdown with the new interval.
export function rescheduleSync() {
  if (state.timer) scheduleSync();
}

// Pull server changes. Serialized: a second caller while one sync runs just awaits it.
export function syncNow(): Promise<void> {
  if (!state.syncing) {
    state.syncing = getActual().then(a => a.sync()).finally(() => { state.syncing = null; });
  }
  return state.syncing;
}
