import { client } from './mcp-client.mjs';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const entry = fileURLToPath(new URL('../fixtures/offline-server.mjs', import.meta.url));
const startup = [], calls = [], rss = []; let schemaBytes = 0;
for (let n = 0; n < 10; n++) {
  const start = performance.now(), c = client(entry, { ...process.env, AGENT_BENCH: '1' });
  try {
    await c.request('initialize', { protocolVersion: '2025-11-25' }); c.notify('notifications/initialized');
    const list = await c.request('tools/list'); startup.push(performance.now() - start); schemaBytes = Buffer.byteLength(JSON.stringify(list.result.tools));
    for (let k = 0; k < 10; k++) {
      const begin = performance.now(); const r = await c.request('tools/call', { name: 'x_search', arguments: { query: 'offline' } }); calls.push(performance.now() - begin);
      rss.push(r.result.structuredContent.benchmark_rss_bytes);
    }
  } finally { c.close(); }
}
const stats = a => { a.sort((x, y) => x - y); return { p50_ms: a[Math.floor(a.length * .5)], p95_ms: a[Math.ceil(a.length * .95) - 1] }; };
const record = { at: new Date().toISOString(), version: '0.1.0', node: process.versions.node, platform: process.platform, starts: 10, mock_calls: 100, startup: stats(startup), mock_roundtrip: stats(calls), peak_observed_rss_bytes: Math.max(...rss), tool_definitions_bytes: schemaBytes, inference_requests: 0, scope: 'Mock provider through stdio. Includes Node startup, excludes npm/npx cold download, network, OAuth, Grok CLI and inference. RSS sampled during calls, not a lifetime peak.' };
await mkdir(new URL('../.artifacts/', import.meta.url), { recursive: true });
await writeFile(new URL('../.artifacts/benchmark.json', import.meta.url), JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify(record, null, 2));
