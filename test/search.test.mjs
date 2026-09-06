import test from 'node:test';
import assert from 'node:assert/strict';
import { directSearch, validate, nativeTool, citations, prompt, cleanAnswer, responseCitations, ENDPOINT, API_ENDPOINT } from '../src/search.mjs';
import { fixtureKey } from './helpers.mjs';
const auth = mode => ({ authMode: mode, credential: async () => ({ key: fixtureKey, authMode: mode, headers: {} }) });
const good = data => new Response(JSON.stringify({ status: 'completed', output_text: 'Evidence https://x.com/example/status/123', ...data }));
test('strict current search filters and desired counts', () => {
  for (const a of [{}, { query: '' }, { query: 'q', count: 1.5 }, { query: 'q', count: 21 }, { query: 'q', include_handles: ['a'], exclude_handles: ['b'] }, { query: 'q', from_date: '2026-02-30' }, { query: 'q', from_date: '2026-09-02', to_date: '2026-09-01' }, { query: 'q', media: 'yes' }, { query: 'q', max_search_results: 10 }, { query: 'q', include_handles: ['bad!'] }]) assert.throws(() => validate(a), { code: 'invalid_arguments' });
  const a = validate({ query: 'q', include_handles: ['@xai'], from_date: '2024-02-29', media: 'both' });
  assert.deepEqual(nativeTool(a), { type: 'x_search', allowed_x_handles: ['xai'], from_date: '2024-02-29', enable_image_understanding: true, enable_video_understanding: true });
  assert.ok(!prompt(a).includes('allowed_x_handles')); assert.ok(prompt(a, true).includes('allowed_x_handles'));
});
test('one POST per mode, correct endpoint, no redirects or fallback; usage stays honest', async () => {
  for (const mode of ['oauth', 'api-key']) {
    const calls = [];
    const r = await directSearch({ query: 'q' }, { ...auth(mode), fetchImpl: async (url, options) => { calls.push({ url, options }); return good({ usage: { input_tokens: 17, output_tokens: 9 } }); } });
    assert.equal(calls.length, 1); assert.equal(calls[0].url, mode === 'oauth' ? ENDPOINT : API_ENDPOINT);
    assert.equal(calls[0].options.redirect, 'error');
    const body = JSON.parse(calls[0].options.body); assert.equal(body.tools[0].type, 'x_search'); assert.equal(body.store, false);
    assert.equal(r.usage.input_tokens, 17); assert.equal(r.usage.total_tokens, null); assert.equal(r.auth_mode, mode);
  }
});
test('status failures are sanitized and never retried', async () => {
  for (const mode of ['oauth', 'api-key']) for (const status of [401, 403, 426, 429, 500]) {
    let calls = 0;
    await assert.rejects(directSearch({ query: 'q' }, { ...auth(mode), fetchImpl: async () => { calls++; return new Response(fixtureKey, { status }); } }), e => !e.message.includes(fixtureKey));
    assert.equal(calls, 1);
  }
});
test('early and mid-credential cancellation send no requests', async () => {
  for (const early of [true, false]) {
    const c = new AbortController(); let requests = 0;
    if (early) c.abort();
    await assert.rejects(directSearch({ query: 'q' }, { ...auth('api-key'), signal: c.signal, credential: async () => { c.abort(); return { key: fixtureKey, authMode: 'api-key' }; }, fetchImpl: async () => { requests++; return good(); } }), { code: 'cancelled' });
    assert.equal(requests, 0);
  }
});
test('transport failure, body interruption, invalid JSON and response limit have safe errors', async () => {
  for (const [fetchImpl, expected] of [
    [async () => { throw new Error(fixtureKey); }, 'request_uncertain'],
    [async () => new Response('invalid'), 'invalid_response'],
    [async () => new Response(new ReadableStream({ start(c) { c.error(new Error(fixtureKey)); } })), 'request_uncertain'],
    [async () => good({ output_text: 'x'.repeat(1000) }), 'response_too_large'],
  ]) await assert.rejects(directSearch({ query: 'q' }, { ...auth('api-key'), fetchImpl, maxResponseBytes: 200 }), e => e.code === expected && !e.message.includes(fixtureKey));
});
test('partial answers and no citations are explicit, secrets are removed from returned fields', async () => {
  const r = await directSearch({ query: 'q' }, { ...auth('api-key'), fetchImpl: async () => good({ status: 'incomplete', output_text: 'Partial ' + fixtureKey }) });
  assert.equal(r.incomplete, true); assert.equal(r.response_status, 'incomplete'); assert.equal(r.citation_status, 'no_x_citations'); assert.equal(r.usage.status, 'unreported'); assert.ok(!JSON.stringify(r).includes(fixtureKey));
});
test('request timeout aborts once without retry', async () => {
  let calls = 0;
  await assert.rejects(directSearch({ query: 'q' }, { ...auth('api-key'), timeoutMs: 5, fetchImpl: async (url, { signal }) => {
    calls++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(good()), 200);
      const abort = () => { clearTimeout(timer); reject(new Error(fixtureKey)); };
      if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
    });
  }}), { code: 'request_uncertain' });
  assert.equal(calls, 1);
});
test('only final answer and attached citations count, deduplicated by status ID', () => {
  const text = 'https://x.com/example/status/123 show render_inline_citation with citation_id is 0';
  const data = { output: [{ type: 'custom_tool_call', text: 'https://x.com/i/status/456' }, { type: 'message', content: [{ annotations: [{ url: 'https://x.com/i/status/123' }] }] }] };
  assert.deepEqual(citations(responseCitations(data, text)), ['https://x.com/example/status/123']);
  assert.equal(cleanAnswer(text), 'https://x.com/example/status/123');
  assert.deepEqual(citations('https://x.com.evil/a/status/1 https://twitter.com/a/status/2'), ['https://x.com/a/status/2']);
  assert.deepEqual(citations('https://x.com/a/status/123abc'), []);
});
