import { schema } from './search.mjs';
import { SearchError, VERSION } from './settings.mjs';
import { Redactor } from './credentials.mjs';

export function toolDefinitions(enableDeep = false) {
  const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true };
  const tools = [{ name: 'x_search', description: 'Search X/Twitter with native Grok search. One Responses request, original-post citations, explicit no-source status and reported usage. No automatic retry. Uses the configured subscription or paid API mode.', inputSchema: schema, annotations }];
  if (enableDeep) tools.push({ name: 'x_deep_search', description: 'Only for explicitly requested deep/cross-checking X research. Custom Grok CLI workflow, not official DeepSearch. Up to four model rounds, subscription only; filters are prompt guidance.', inputSchema: schema, annotations });
  return tools;
}
export function serve({ input = process.stdin, output = process.stdout, search, deep, enableDeep = false, redactor = new Redactor(), maxMessageBytes = 65_536 }) {
  let buffer = '', initialized = false, ready = false, closing = false, active;
  const definitions = toolDefinitions(enableDeep);
  const send = obj => { if (!closing) output.write(JSON.stringify(obj) + '\n'); };
  const error = (id, code, message) => send({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
  function stop() { closing = true; active?.controller.abort(); }
  async function handle(m) {
    if (!m || Array.isArray(m) || m.jsonrpc !== '2.0' || typeof m.method !== 'string' || ('id' in m && typeof m.id !== 'string' && !(Number.isSafeInteger(m.id)))) return error(null, -32600, 'Invalid Request');
    if (!('id' in m)) {
      if (m.method === 'notifications/initialized' && initialized) ready = true;
      if (m.method === 'notifications/cancelled' && active?.id === m.params?.requestId) active.controller.abort();
      return;
    }
    const reply = result => send({ jsonrpc: '2.0', id: m.id, result });
    if (m.method === 'initialize') {
      if (initialized) return error(m.id, -32600, 'Already initialized');
      initialized = true;
      const supported = ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25'];
      return reply({ protocolVersion: supported.includes(m.params?.protocolVersion) ? m.params.protocolVersion : '2025-11-25', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'agent-x-search', version: VERSION }, instructions: 'Search consumes the configured Grok subscription quota or API spend. Never automatically retry uncertain failures.' });
    }
    if (m.method === 'ping') return reply({});
    if (!ready) return error(m.id, -32002, 'Initialize first');
    if (m.method === 'tools/list') return reply({ tools: definitions });
    if (m.method !== 'tools/call') return error(m.id, -32601, 'Method not found');
    if (!definitions.some(t => t.name === m.params?.name)) return error(m.id, -32602, 'Unknown tool');
    if (active?.id === m.id) return error(m.id, -32600, 'Duplicate active request ID');
    let owned;
    try {
      if (active) throw new SearchError('busy', 'Another search is active; no request was sent.');
      owned = { id: m.id, controller: new AbortController() }; active = owned;
      const fn = m.params.name === 'x_search' ? search : deep;
      const value = await fn(m.params.arguments, { signal: owned.controller.signal });
      const safe = redactor.object(value);
      reply({ content: [{ type: 'text', text: JSON.stringify(safe) }], structuredContent: safe, isError: false });
    } catch (e) {
      const safe = { error: e instanceof SearchError ? e.code : 'internal_error', message: e instanceof SearchError ? redactor.text(e.message) : 'Search failed internally; no automatic retry.' };
      reply({ content: [{ type: 'text', text: JSON.stringify(safe) }], structuredContent: safe, isError: true });
    } finally { if (active === owned) active = undefined; }
  }
  function oversized() { error(null, -32600, 'Message too large'); stop(); input.destroy(); }
  input.setEncoding('utf8');
  input.on('data', chunk => {
    buffer += chunk;
    let end;
    while (!closing && (end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
      if (Buffer.byteLength(line) > maxMessageBytes) { oversized(); return; }
      if (!line.trim()) continue;
      let m; try { m = JSON.parse(line); } catch { error(null, -32700, 'Parse error'); continue; }
      void handle(m).catch(() => error(m?.id, -32603, 'Internal error'));
    }
    if (!closing && Buffer.byteLength(buffer) > maxMessageBytes) oversized();
  });
  input.on('end', stop); input.on('error', stop); output.on('error', stop);
  return { stop };
}
