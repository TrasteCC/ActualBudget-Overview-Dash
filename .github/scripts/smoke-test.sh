#!/usr/bin/env bash
# Runs the built image on the demo data and fails if a browser couldn't use it. A green build alone
# shipped v26.11.0-r1, whose /api/overview browsers couldn't decode. Not covered: a real Actual server.
set -euo pipefail

name=overview-smoke
docker run -d --name "$name" -e DEMO=1 "$1" >/dev/null
trap 'docker rm -f "$name" >/dev/null' EXIT

docker exec -i -w /app "$name" node - <<'JS' || { docker logs "$name" 2>&1 | tail -n 20; exit 1; }
new (require('better-sqlite3'))(':memory:').close();
require('@actual-app/api');

// fetch decodes a body only as its headers say, as a browser does.
const get = path => fetch(`http://127.0.0.1:3000${path}`, { headers: { 'accept-encoding': 'gzip' } });

(async () => {
  for (let i = 0; !(await get('/api/health').then(r => r.ok, () => false)); i++) {
    if (i === 30) throw new Error('the server did not start');
    await new Promise(r => setTimeout(r, 1000));
  }
  const page = await get('/');
  if (!page.ok) throw new Error(`/ returned ${page.status}`);
  const overview = await get('/api/overview');
  if (!overview.ok) throw new Error(`/api/overview returned ${overview.status}`);
  const { months, transactions } = await overview.json();
  if (!months?.length || !transactions?.length) throw new Error('/api/overview returned no data');
  console.log(`OK: ${months.length} months, ${transactions.length} transactions`);
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
JS
