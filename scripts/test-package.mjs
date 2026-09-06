import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const exec = promisify(execFile), root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = join(root, '.artifacts'); await mkdir(artifacts, { recursive: true });
if (!process.env.npm_execpath) throw new Error('Run with npm run test:package.');
const npm = args => exec(process.execPath, [process.env.npm_execpath, ...args], { cwd: root, windowsHide: true, maxBuffer: 4_194_304 });
const pack = JSON.parse((await npm(['pack', '--json', '--ignore-scripts', '--pack-destination', artifacts])).stdout)[0];
assert.ok(pack.size <= 102_400, 'Packed artifact exceeds 100 KiB');
for (const f of pack.files) assert.match(f.path, /^(?:src\/|bin\/|package.json$|README(?:\.zh-CN)?\.md$|LICENSE$|CHANGELOG.md$)/);
const dest = await mkdtemp(join(artifacts, 'installed-'));
await writeFile(join(dest, 'package.json'), '{"private":true}');
await npm(['install', '--prefix', dest, '--omit=dev', '--ignore-scripts', '--offline', '--no-audit', '--no-fund', join(artifacts, pack.filename)]);
const installed = join(dest, 'node_modules', 'agent-x-search'), entry = join(installed, 'bin', 'agent-x-search.mjs');
const pkg = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
assert.equal(Object.keys(pkg.dependencies || {}).length, 0);
const childEnv = { ...process.env, AGENT_X_SEARCH_AUTH: 'api-key', AGENT_X_SEARCH_ENABLE_DEEP: '0', XAI_API_KEY: '' };
const version = await exec(process.execPath, ['--use-env-proxy', entry, '--version'], { env: childEnv, windowsHide: true }); assert.equal(version.stdout.trim(), '0.1.0');
const shim = join(dest, 'node_modules', '.bin', process.platform === 'win32' ? 'agent-x-search.cmd' : 'agent-x-search');
const shimResult = process.platform === 'win32'
  ? await exec(join(process.env.SystemRoot || process.env.SYSTEMROOT, 'System32', 'cmd.exe'), ['/d', '/s', '/c', `""${shim}" --version"`], { windowsHide: true, windowsVerbatimArguments: true })
  : await exec(shim, ['--version']);
assert.equal(shimResult.stdout.trim(), '0.1.0');
for (const client of ['codex', 'claude-code', 'cursor', 'vscode', 'opencode', 'cline']) {
  const { stdout } = await exec(process.execPath, [entry, 'config', '--client', client], { env: childEnv, windowsHide: true });
  assert.match(stdout, /agent-x-search@0\.1\.0/); if (client !== 'codex') JSON.parse(stdout);
}
for (const fixtureMode of [false, true]) {
  const transport = new StdioClientTransport({ command: process.execPath, args: ['--use-env-proxy', fixtureMode ? fileURLToPath(new URL('../fixtures/offline-server.mjs', import.meta.url)) : entry], env: { ...childEnv, AGENT_TEST_ROOT: installed }, stderr: 'pipe' });
  const client = new Client({ name: 'packed-artifact-test', version: '1' }); let stderr = '';
  transport.stderr?.on('data', s => stderr += s);
  try {
    await client.connect(transport); assert.deepEqual((await client.listTools()).tools.map(t => t.name), ['x_search']);
    const result = await client.callTool({ name: 'x_search', arguments: fixtureMode ? { query: 'offline evidence' } : {} });
    assert.equal(result.isError, !fixtureMode);
    if (fixtureMode) assert.equal(result.structuredContent.citation_count, 1);
    else assert.equal(result.structuredContent.error, 'invalid_arguments');
    assert.equal(stderr, '');
  } finally { await client.close(); }
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fileHashes = {};
for (const f of pack.files) {
  fileHashes[f.path] = hash(await readFile(join(installed, f.path)));
  assert.equal(fileHashes[f.path], hash(await readFile(join(root, f.path))), 'Installed content differs: ' + f.path);
}
const record = { at: new Date().toISOString(), node: process.versions.node, platform: process.platform, package: { name: pack.name, version: pack.version, filename: pack.filename, size: pack.size, unpackedSize: pack.unpackedSize, integrity: pack.integrity }, tarball_sha256: hash(await readFile(join(artifacts, pack.filename))), file_sha256: fileHashes, file_paths: pack.files.map(f => f.path), runtime_dependencies: 0, installed_bin_shim_pass: true, installed_entry_handshake_pass: true, installed_modules_mock_call_pass: true, six_configs_pass: true, inference_requests: 0 };
await writeFile(join(artifacts, 'package-test.json'), JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify(record, null, 2));
