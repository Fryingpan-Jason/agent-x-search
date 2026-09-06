import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseSettings } from '../src/settings.mjs';
import { createCredentials, Redactor } from '../src/credentials.mjs';
import { temporaryDirectory, cleanup, cliEnvironment, assertSafeInspection, deepSearch, searchCliArgs, runCli } from '../src/runner.mjs';
import { fakeHome, temporary, fixtureKey } from './helpers.mjs';
const safe = { projectRoot: null, projectInstructions: [], loginPolicy: { apiKeyAuthDisabled: true }, hooks: [], mcpServers: [], plugins: [], lspServers: [] };
test('temporary cwd is outside Git and cleanup refuses anything except its own child', async t => {
  const root = await temporary(t), dir = await temporaryDirectory(root);
  await writeFile(join(dir, 'marker'), 'test'); await cleanup(dir, root); assert.deepEqual(await readdir(root), []);
  await assert.rejects(cleanup(root, root), { code: 'unsafe_cleanup' });
  await mkdir(join(root, '.git')); await assert.rejects(temporaryDirectory(root), { code: 'unsafe_cli_cwd' });
  assert.deepEqual(await readdir(root), ['.git']);
});
test('deep environment excludes keys, injected helpers/endpoints and disables retries', () => {
  const s = parseSettings([], {}), env = cliEnvironment(s, { PATH: 'path', HOME: '/home/test', XAI_API_KEY: 'secret', GROK_AUTH_PROVIDER_COMMAND: 'bad', GROK_MODELS_BASE_URL: 'bad', GROK_DEBUG: '1' });
  assert.equal(env.XAI_API_KEY, undefined); assert.equal(env.GROK_AUTH_PROVIDER_COMMAND, undefined); assert.equal(env.GROK_MODELS_BASE_URL, undefined); assert.equal(env.GROK_DEBUG, undefined);
  assert.equal(env.HOME, '/home/test'); assert.equal(env.GROK_DISABLE_API_KEY_AUTH, '1'); assert.equal(JSON.parse(env.GROK_CONFIG).models.max_retries, 0);
  const args = searchCliArgs({ query: 'q', count: 1, detail: 'brief', media: 'none' }, 'grok-4.6');
  assert.equal(args[args.indexOf('--tools') + 1], 'x_search'); assert.ok(args.includes('MCPTool')); assert.ok(args.includes('--no-subagents')); assert.ok(args.includes('read-only'));
});
test('discovery fails closed on unknown schema, hooks, plugins, MCP or project instructions', () => {
  assert.doesNotThrow(() => assertSafeInspection(safe));
  for (const key of ['hooks', 'mcpServers', 'plugins', 'lspServers']) assert.throws(() => assertSafeInspection({ ...safe, [key]: [{}] }), { code: 'unsafe_cli_integrations' });
  assert.throws(() => assertSafeInspection({}), { code: 'cli_preflight_failed' });
  assert.throws(() => assertSafeInspection({ ...safe, projectInstructions: ['AGENTS.md'] }), { code: 'cli_preflight_failed' });
});
test('mock deep workflow performs inspect then restricted CLI once and cleans cwd', async t => {
  const home = await fakeHome(t), root = await temporary(t);
  const settings = parseSettings(['--enable-deep', '--grok-home', home.path, '--temp-dir', root], {});
  const credentials = createCredentials(settings), calls = [];
  const r = await deepSearch({ query: 'q' }, { settings, credentials, run: async (s, args, options) => {
    calls.push({ args, options });
    return { stdout: JSON.stringify(args[0] === 'inspect' ? safe : { text: 'Evidence https://x.com/example/status/123', num_turns: 1, stopReason: 'end_turn', usage: { input_tokens: 5 } }), stderr: '' };
  }});
  assert.equal(calls.length, 2); assert.equal(calls[1].options.inference, true); assert.equal(r.model_rounds, 1); assert.equal(r.citation_count, 1); assert.deepEqual(await readdir(root), []);
});
test('failed discovery sends no inference and cleans scratch directory', async t => {
  const home = await fakeHome(t), root = await temporary(t), settings = parseSettings(['--enable-deep', '--grok-home', home.path, '--temp-dir', root], {});
  let calls = 0;
  await assert.rejects(deepSearch({ query: 'q' }, { settings, credentials: createCredentials(settings), run: async () => { calls++; return { stdout: JSON.stringify({ ...safe, hooks: [{}] }) }; } }), { code: 'unsafe_cli_integrations' });
  assert.equal(calls, 1); assert.deepEqual(await readdir(root), []);
});
test('subprocess output is redacted; failures never echo stderr', async t => {
  const root = await temporary(t), settings = parseSettings(['--grok-cli', process.execPath, '--temp-dir', root], {}), r = new Redactor(); r.add(fixtureKey);
  const result = await runCli(settings, ['-e', `process.stdout.write(${JSON.stringify(fixtureKey)})`], { cwd: root, redactor: r });
  assert.equal(result.stdout, '[REDACTED]');
  await assert.rejects(runCli(settings, ['-e', `process.stderr.write(${JSON.stringify(fixtureKey)});process.exit(1)`], { cwd: root, redactor: r }), e => !e.message.includes(fixtureKey));
});
test('owned CLI process is terminated on timeout or cancellation; pre-cancel never spawns', async t => {
  const root = await temporary(t), settings = parseSettings(['--grok-cli', process.execPath, '--temp-dir', root], {}), redactor = new Redactor();
  await assert.rejects(runCli(settings, ['-e', 'setInterval(()=>{},1000)'], { cwd: root, redactor, timeout: 80 }), { code: 'cli_preflight_failed' });
  const controller = new AbortController();
  const promise = runCli(settings, ['-e', 'setInterval(()=>{},1000)'], { cwd: root, redactor, signal: controller.signal });
  setTimeout(() => controller.abort(), 80);
  await assert.rejects(promise, { code: 'cancelled' });
  assert.throws(() => runCli(settings, [], { signal: controller.signal, spawnImpl: () => { throw new Error('must not spawn'); } }), { code: 'cancelled' });
});
