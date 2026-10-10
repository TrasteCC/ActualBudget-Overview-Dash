import * as api from '@actual-app/api';
import fs from 'node:fs';
let ready = null;
export function getActual() {
  if (!ready) {
    ready = (async () => {
      const dataDir = process.env.ACTUAL_DATA_DIR || './data';
      fs.mkdirSync(dataDir, { recursive: true });
      await api.init({ dataDir, serverURL: process.env.ACTUAL_SERVER_URL, password: process.env.ACTUAL_PASSWORD });
      await api.downloadBudget(process.env.ACTUAL_SYNC_ID, process.env.ACTUAL_E2E_PASSWORD ? { password: process.env.ACTUAL_E2E_PASSWORD } : undefined);
      return api;
    })().catch(e => { ready = null; throw e; });
  }
  return ready;
}
