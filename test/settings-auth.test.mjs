import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseSettings, resolveCli, checkNode } from '../src/settings.mjs';
import { createCredentials, Redactor, readSession } from '../src/credentials.mjs';
import { clientConfig, CLIENTS, doctor } from '../src/command.mjs';
import { fakeHome, fixtureKey, fixtureRefresh } from './helpers.mjs';

test('defaults, precedence and billing conflicts fail before requests', () => {
  assert.equal(parseSettings([], {}).auth, 'oauth'); assert.equal(parseSettings([], {}).enableDeep, false); assert.equal(parseSettings([], {}).timeoutMs, 300_000); assert.equal(parseSettings([], {}).deepTimeoutMs, 900_000);
  assert.equal(parseSettings(['--model', 'chosen'], { AGENT_X_SEARCH_MODEL: 'env' }).model, 'chosen');
  assert.equal(parseSettings([], { AGENT_X_SEARCH_MODEL: 'env' }).model, 'env'); assert.equal(parseSettings(['--timeout-ms', '600000'], { AGENT_X_SEARCH_TIMEOUT_MS: '120000' }).timeoutMs, 600_000); assert.equal(parseSettings([], { AGENT_X_SEARCH_DEEP_TIMEOUT_MS: '1200000' }).deepTimeoutMs, 1_200_000);
  for (const args of [['--auth', 'auto'], ['--auth', 'api-key', '--enable-deep'], ['--grok-home', 'relative'], ['--model', 'a\nb'], ['--timeout-ms', '999'], ['--deep-timeout-ms', '3600001'], ['--timeout-ms', 'abc'], ['--unknown'], ['--auth']]) assert.throws(() => parseSettings(args, {}), { code: 'invalid_configuration' });
  assert.throws(() => checkNode('24.4.0')); assert.doesNotThrow(() => checkNode('24.5.0'));
});
test('CLI location uses platform and overrides instead of a personal path', () => {
  const s = parseSettings([], {});
  for (const platform of ['win32', 'linux', 'darwin']) {
    const path = resolveCli(s, { platform, env: {}, exists: () => true });
    assert.ok(path.endsWith(platform === 'win32' ? 'grok.exe' : 'grok'));
  }
  assert.equal(resolveCli({ ...s, cliOverride: process.execPath }, { exists: () => true }), process.execPath);
  assert.throws(() => resolveCli(s, { env: {}, exists: () => false }), { code: 'cli_unavailable' });
});
test('OAuth does not read API key and uses cached CLI version; metadata absence fails closed', async t => {
  const home = await fakeHome(t), env = {};
  Object.defineProperty(env, 'XAI_API_KEY', { get: () => { throw new Error('API key read in OAuth mode'); } });
  const settings = parseSettings(['--grok-home', home.path], {});
  const credentials = createCredentials(settings, { env });
  const result = await credentials.get();
  assert.equal(result.key, fixtureKey); assert.equal(result.headers['x-grok-client-version'], '9.8.7');
  assert.equal(result.authMode, 'oauth');
  assert.equal(credentials.redactor.text(fixtureKey + fixtureRefresh), '[REDACTED][REDACTED]');
  await writeFile(join(home.path, 'models_cache.json'), '{}');
  await assert.rejects(credentials.get(), { code: 'cli_metadata_required' });
});
test('explicit API key mode never reads OAuth or calls refresh', async () => {
  const credentials = createCredentials(parseSettings(['--auth', 'api-key'], {}), { env: { XAI_API_KEY: fixtureKey }, read: () => { throw new Error('OAuth read'); }, refresh: () => { throw new Error('refresh called'); } });
  const auth = await credentials.get(); assert.equal(auth.key, fixtureKey); assert.equal(auth.authMode, 'api-key');
  assert.equal(auth.headers['X-XAI-Token-Auth'], undefined);
  await assert.rejects(createCredentials(parseSettings(['--auth', 'api-key'], {}), { env: {} }).get(), { code: 'api_key_required' });
});
test('concurrent expired credentials perform one official refresh, reread, and fail safely', async t => {
  const home = await fakeHome(t, true), settings = parseSettings(['--grok-home', home.path], {});
  let refreshed = false, count = 0;
  const credentials = createCredentials(settings, { read: async () => ({ ...home.session, expires_at: refreshed ? '2100-01-01' : '2000-01-01' }), refresh: async () => { count++; await new Promise(r => setTimeout(r, 10)); refreshed = true; } });
  await Promise.all([credentials.get(), credentials.get()]); assert.equal(count, 1);
  const fail = createCredentials(settings, { refresh: async () => { throw new Error(fixtureKey); } });
  await assert.rejects(fail.get(), e => e.code === 'reauth_required' && !e.message.includes(fixtureKey));
});
test('malformed or ambiguous auth is safe and redactor covers JWT/bearer echoes', async t => {
  const home = await fakeHome(t), settings = parseSettings(['--grok-home', home.path], {}), r = new Redactor();
  await writeFile(join(home.path, 'auth.json'), JSON.stringify({ one: home.session, two: home.session }));
  await assert.rejects(readSession(settings, r), { code: 'reauth_required' });
  assert.ok(!r.text('Bearer something eyJabc.abc.def').includes('eyJabc'));
  await writeFile(join(home.path, 'auth.json'), 'invalid');
  await assert.rejects(readSession(settings, r), { code: 'reauth_required' });
});
test('six client configurations are portable by default, pinned, and never include keys', () => {
  for (const client of CLIENTS) {
    const s = parseSettings(['config', '--client', client, '--auth', 'api-key'], {});
    const text = clientConfig(s);
    assert.match(text, /agent-x-search@0\.1\.0/); assert.ok(!text.includes(process.execPath));
    assert.ok(!text.includes('XAI_API_KEY'));
    assert.match(text, /--timeout-ms/); assert.match(text, /--deep-timeout-ms/);
    if (client !== 'codex') {
      const doc = JSON.parse(text);
      assert.ok(client === 'vscode' ? doc.servers : client === 'opencode' ? doc.mcp : doc.mcpServers);
    }
  }
  const text = clientConfig(parseSettings(['config', '--client', 'cursor', '--local'], {}));
  assert.ok(text.includes(JSON.stringify(process.execPath).slice(1, -1))); assert.match(text, /use-env-proxy/);
  assert.match(clientConfig(parseSettings(['config', '--client', 'codex', '--enable-deep'], {})), /tool_timeout_sec = 930/);
});
test('doctor reads metadata only; API mode works without CLI', async t => {
  const home = await fakeHome(t);
  const report = await doctor(parseSettings(['doctor', '--grok-home', home.path], {}));
  assert.equal(report.inference_requests, 0); assert.ok(!JSON.stringify(report).includes(fixtureKey));
  const api = await doctor(parseSettings(['doctor', '--auth', 'api-key'], {}), { XAI_API_KEY: fixtureKey });
  assert.equal(api.ok, true); assert.equal(api.checks.length, 2);
});
