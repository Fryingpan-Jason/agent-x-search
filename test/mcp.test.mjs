import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { serve, toolDefinitions } from '../src/transport.mjs';
import { client } from '../scripts/mcp-client.mjs';
const fixture = fileURLToPath(new URL('../fixtures/offline-server.mjs', import.meta.url));

test('official MCP SDK discovers and calls the default and opt-in tools', async () => {
  for (const enabled of [false, true]) {
    const transport = new StdioClientTransport({ command: process.execPath, args: [fixture, ...(enabled ? ['--enable-deep'] : [])], stderr: 'pipe' });
    const sdk = new Client({ name: 'sdk-acceptance', version: '1' }); let stderr = '';
    transport.stderr?.on('data', s => stderr += s);
    try {
      await sdk.connect(transport);
      const list = await sdk.listTools();
      assert.deepEqual(list.tools.map(t => t.name), enabled ? ['x_search', 'x_deep_search'] : ['x_search']);
      for (const t of list.tools) {
        const r = await sdk.callTool({ name: t.name, arguments: { query: 'offline' } });
        assert.equal(r.isError, false); assert.equal(r.structuredContent.citation_count, 1); assert.ok(!JSON.stringify(r).includes('fixture-token-DO-NOT-LOG'));
      }
      const invalid = await sdk.callTool({ name: 'x_search', arguments: { query: '' } });
      assert.equal(invalid.structuredContent.error, 'invalid_arguments'); assert.equal(stderr, '');
    } finally { await sdk.close(); }
  }
});
test('production entry initializes without OAuth or CLI and rejects bad query before auth', async () => {
  const c = client(fileURLToPath(new URL('../bin/agent-x-search.mjs', import.meta.url)), { ...process.env, AGENT_X_SEARCH_AUTH: 'api-key', XAI_API_KEY: '', AGENT_X_SEARCH_ENABLE_DEEP: '0' });
  try {
    assert.equal((await c.request('tools/list')).error.code, -32002);
    await c.request('initialize', { protocolVersion: '2025-11-25' }); c.notify('notifications/initialized');
    assert.equal((await c.request('tools/list')).result.tools.length, 1);
    const invalid = await c.request('tools/call', { name: 'x_search', arguments: {} });
    assert.equal(invalid.result.structuredContent.error, 'invalid_arguments');
    assert.equal((await c.request('tools/call', { name: 'x_deep_search' })).error.code, -32602);
  } finally { c.close(); }
});
test('per-message framing accepts combined messages and fragmented unicode', async () => {
  const input = new PassThrough(), output = new PassThrough(); let text = '';
  output.on('data', s => text += s);
  const server = serve({ input, output, search: async () => ({}), maxMessageBytes: 256 });
  const send = m => JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n';
  const init = send({ id: 1, method: 'initialize' }) + send({ method: 'notifications/initialized' });
  input.write(init);
  input.write(Array.from({ length: 20 }, (_, i) => send({ id: i + 2, method: 'ping' })).join(''));
  const encoded = Buffer.from(send({ id: '中文', method: 'ping' }));
  for (let i = 0; i < encoded.length; i++) input.write(encoded.subarray(i, i + 1));
  await new Promise(r => setImmediate(r));
  const results = text.trim().split('\n').map(JSON.parse);
  assert.equal(results.length, 22); assert.equal(results.at(-1).id, '中文');
  server.stop(); input.end(); output.end();
});
test('busy calls do not dispatch; cancellation aborts; malformed and oversized messages are rejected', async () => {
  const input = new PassThrough(), output = new PassThrough(); let text = '', calls = 0;
  output.on('data', s => text += s);
  const search = async (a, { signal }) => { calls++; await new Promise(r => signal.addEventListener('abort', r, { once: true })); return { cancelled: true }; };
  serve({ input, output, search, maxMessageBytes: 256 });
  const send = m => input.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n');
  send({ id: 1, method: 'initialize' }); send({ method: 'notifications/initialized' });
  send({ id: 2, method: 'tools/call', params: { name: 'x_search', arguments: { query: 'a' } } });
  send({ id: 3, method: 'tools/call', params: { name: 'x_search', arguments: { query: 'b' } } });
  send({ method: 'notifications/cancelled', params: { requestId: 2 } });
  input.write('not JSON\n'); await new Promise(r => setImmediate(r));
  assert.equal(calls, 1); assert.match(text, /busy/); assert.match(text, /-32700/);
  input.write('x'.repeat(257)); assert.match(text, /Message too large/); output.end();
});
test('default tool definition budget', () => assert.ok(Buffer.byteLength(JSON.stringify(toolDefinitions())) <= 4096));
