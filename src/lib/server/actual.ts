import * as api from '@actual-app/api';
import fs from 'node:fs';
import { getSettings } from './settings';

// One budget session per process (2026-10-10). @actual-app/api keeps the budget as a local SQLite
// file, so queries are in-process and concurrent requests are safe; only init/download/sync go to
// the network. This replaces the actual-http-api sidecar, which re-opened the budget per request.

export type Actual = typeof api;

let ready: Promise<Actual> | null = null;
let syncTimer: NodeJS.Timeout | null = null;
let syncing: Promise<void> | null = null;

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export function getActual(): Promise<Actual> {
  if (!ready) {
    ready = (async () => {
      if (process.env.ACTUAL_INSECURE_TLS === '1') process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      const dataDir = process.env.ACTUAL_DATA_DIR || './data';
      fs.mkdirSync(dataDir, { recursive: true });
      await api.init({ dataDir, serverURL: required('ACTUAL_SERVER_URL'), password: required('ACTUAL_PASSWORD') });
      const e2e = process.env.ACTUAL_E2E_PASSWORD;
      await api.downloadBudget(required('ACTUAL_SYNC_ID'), e2e ? { password: e2e } : undefined);
      const every = getSettings().syncIntervalMin * 60_000;
      syncTimer ??= setInterval(() => { syncNow().catch(err => console.error('[actual] periodic sync failed', err)); }, every);
      syncTimer.unref?.();
      return api;
    })().catch(err => { ready = null; throw err; });
  }
  return ready;
}

// Pull server changes. Serialized: a second caller while one sync runs just awaits it.
export function syncNow(): Promise<void> {
  if (!syncing) {
    syncing = getActual().then(a => a.sync()).finally(() => { syncing = null; });
  }
  return syncing;
}
