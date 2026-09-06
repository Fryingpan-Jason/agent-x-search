import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { toolDefinitions } from '../src/transport.mjs';
const exec = promisify(execFile), root = fileURLToPath(new URL('../', import.meta.url));
const git = async args => (await exec('git', ['-c', `safe.directory=${root}`, ...args], { cwd: root, maxBuffer: 16_777_216 })).stdout;
const files = (await git(['ls-files', '-z'])).split('\0').filter(Boolean);
const forbidden = /^(?:\.local\/|\.artifacts\/|\.npm-cache\/|node_modules\/|evidence\/)|(?:^|\/)auth\.json|\.env(?:$|\.)/;
// Rules describe personal machine markers without embedding those markers as plaintext in public files.
const personal = [new RegExp('C:[\\\\/]Users[\\\\/](?!<|example|YOUR_)', 'i'), new RegExp('D:[\\\\/]Develop', 'i'), /CodexSandbox(?:Offline|Online)/, /01a0[0-9a-f-]{30,}/];
const secrets = [/\b(?:xai|sk)-[A-Za-z0-9_-]{20,}/, /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/];
let credentials = [];
// Explicit local option: read only these existing credentials into memory, never print or persist them.
if (process.env.AGENT_X_SEARCH_AUDIT_AUTH_FILE) {
  const auth = JSON.parse(await readFile(process.env.AGENT_X_SEARCH_AUDIT_AUTH_FILE, 'utf8'));
  credentials = Object.values(auth).flatMap(s => [s?.key, s?.refresh_token]).filter(v => typeof v === 'string' && v.length >= 8);
}
const inspect = (name, text) => {
  assert.ok(!forbidden.test(name), `Private artifact is tracked: ${name}`);
  assert.ok(!personal.some(p => p.test(text)), `Personal environment marker: ${name}`);
  assert.ok(!secrets.some(p => p.test(text)) && !credentials.some(s => text.includes(s)), `Credential pattern: ${name}`);
};
for (const f of files) inspect(f, await readFile(join(root, f), 'utf8'));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
assert.equal(pkg.private, undefined); assert.equal(pkg.license, 'MIT'); assert.equal(Object.keys(pkg.dependencies || {}).length, 0);
assert.ok(Buffer.byteLength(JSON.stringify(toolDefinitions())) <= 4096);
const pack = JSON.parse(await readFile(join(root, '.artifacts/package-test.json'), 'utf8'));
assert.ok(pack.package.size <= 102400);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(await readFile(join(root, '.artifacts', pack.package.filename))), pack.tarball_sha256, 'Tarball differs from tested artifact');
for (const f of pack.file_paths) {
  assert.ok(files.includes(f));
  const bytes = await readFile(join(root, f));
  assert.equal(hash(bytes), pack.file_sha256[f], 'Source changed after package testing: ' + f);
  inspect(f, bytes.toString('utf8'));
}
let commits = 0;
if (process.argv.includes('--history')) {
  const branch = (await git(['branch', '--show-current'])).trim();
  assert.ok(['public-main', 'main'].includes(branch) || process.env.GITHUB_ACTIONS === 'true', 'History audit must run on the clean public branch (or its CI merge checkout).');
  const revisions = (await git(['rev-list', 'HEAD'])).trim().split('\n').filter(Boolean); commits = revisions.length;
  for (const rev of revisions) {
    const names = (await git(['ls-tree', '-r', '--name-only', rev])).trim().split('\n').filter(Boolean);
    for (const f of names) inspect(f, await git(['show', `${rev}:${f}`]));
    const message = await git(['show', '-s', '--format=%B', rev]); inspect('commit-message', message);
  }
}
const report = { at: new Date().toISOString(), tracked_files: files.length, history_commits_scanned: commits, credential_value_scan: credentials.length > 0, file_and_package_scan_pass: true, runtime_dependencies: 0, compressed_bytes: pack.package.size, default_tool_bytes: Buffer.byteLength(JSON.stringify(toolDefinitions())), inference_requests: 0 };
await mkdir(join(root, '.artifacts'), { recursive: true }); await writeFile(join(root, '.artifacts/release-audit.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
