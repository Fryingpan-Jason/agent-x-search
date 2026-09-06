import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, realpath, access, rm, constants } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { SearchError, resolveCli } from './settings.mjs';
import { readSession } from './credentials.mjs';
import { validate, prompt, result, usageSummary, checkCancelled } from './search.mjs';

export function cliEnvironment(settings, base = process.env) {
  const env = {};
  const allowed = /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|USERPROFILE|HOME|HOMEDRIVE|HOMEPATH|APPDATA|LOCALAPPDATA|PROGRAMDATA|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY|SSL_CERT_FILE|SSL_CERT_DIR|LANG|LC_ALL)$/i;
  for (const [key, value] of Object.entries(base)) if (allowed.test(key)) env[key] = value;
  return { ...env, TEMP: settings.tempRoot, TMP: settings.tempRoot, TMPDIR: settings.tempRoot, GROK_HOME: settings.grokHome, GROK_DISABLE_API_KEY_AUTH: '1', GROK_DISABLE_AUTOUPDATER: '1', GROK_CAMPAIGNS: '0', GROK_MEMORY: '0', GROK_TITLE_REFRESH: '0', GROK_TURN_SUMMARY: '0', GROK_SESSION_RECAP: '0', GROK_CLAUDE_HOOKS_ENABLED: '0', GROK_CURSOR_HOOKS_ENABLED: '0', GROK_CLAUDE_MCPS_ENABLED: '0', GROK_CURSOR_MCPS_ENABLED: '0', GROK_MANAGED_MCPS_ENABLED: '0', GROK_MANAGED_MCP_GATEWAY_TOOLS_ENABLED: '0', GROK_EXTERNAL_OTEL: '0', GROK_CONFIG: JSON.stringify({ models: { max_retries: 0 }, features: { backend_tools: true, non_git_warning: false, remote_fetch: false, title_refresh: false, turn_summary: false, session_recap: false, managed_config: false, telemetry: 'off' } }) };
}
export async function cleanup(cwd, root) {
  const target = await realpath(cwd), parent = await realpath(root);
  if (dirname(target) !== parent || !basename(target).startsWith('search-')) throw new SearchError('unsafe_cleanup', 'Scratch path check failed.');
  await rm(target, { recursive: true, force: true });
}
export async function temporaryDirectory(root) {
  await mkdir(root, { recursive: true });
  const cwd = await mkdtemp(join(root, 'search-'));
  try {
    let parent = await realpath(cwd);
    while (true) {
      try { await access(join(parent, '.git')); throw new SearchError('unsafe_cli_cwd', 'Scratch directory is inside a Git repository. Set --temp-dir outside it.'); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
      const next = dirname(parent); if (next === parent) break; parent = next;
    }
    return cwd;
  } catch (e) { await cleanup(cwd, root); throw e; }
}
export function runCli(settings, args, { cwd, redactor, signal, inference = false, timeout = 30_000, env = cliEnvironment(settings), spawnImpl = spawn } = {}) {
  checkCancelled(signal);
  const executable = resolveCli(settings);
  return new Promise((resolve, reject) => {
    let stdout = '', stderr = '', stopped = false;
    const child = spawnImpl(executable, args, { cwd, env, shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    const stop = () => {
      if (stopped) return;
      stopped = true;
      if (!child.pid) { child.kill(); return; }
      if (process.platform === 'win32') {
        const killer = spawn(join(process.env.SystemRoot || process.env.SYSTEMROOT || 'C:\\Windows', 'System32', 'taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', shell: false });
        killer.on('error', () => child.kill()); killer.on('close', () => child.kill());
      } else { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill(); } }
    };
    const timer = setTimeout(stop, timeout);
    signal?.addEventListener('abort', stop, { once: true });
    if (signal?.aborted) stop();
    const finish = () => { clearTimeout(timer); signal?.removeEventListener('abort', stop); };
    child.stdout.on('data', chunk => { if (stopped) return; stdout += chunk; if (Buffer.byteLength(stdout) > 4_194_304) stop(); });
    child.stderr.on('data', chunk => { if (stopped) return; stderr += chunk; if (Buffer.byteLength(stderr) > 1_048_576) stop(); });
    child.on('error', () => { finish(); reject(new SearchError('cli_unavailable', 'Grok CLI could not start. Check the executable path.')); });
    child.on('close', code => {
      finish();
      if (signal?.aborted) return reject(new SearchError('cancelled', 'Search cancelled; upstream quota may have been consumed. No retry.'));
      if (stopped) return reject(new SearchError(inference ? 'request_uncertain' : 'cli_preflight_failed', 'CLI timeout/output limit; no automatic retry.'));
      if (code !== 0) return reject(new SearchError(inference ? 'cli_error' : 'cli_preflight_failed', 'Official Grok CLI failed. Check grok models and platform support; no automatic retry.'));
      resolve({ stdout: redactor.text(stdout), stderr: redactor.text(stderr) });
    });
  });
}
export async function refreshSession(settings, redactor) {
  const cwd = await temporaryDirectory(settings.tempRoot);
  try { await runCli(settings, ['models'], { cwd, redactor }); } finally { await cleanup(cwd, settings.tempRoot); }
}
export function assertSafeInspection(data) {
  if (!data || data.projectRoot !== null || !Array.isArray(data.projectInstructions) || data.projectInstructions.length || data.loginPolicy?.apiKeyAuthDisabled !== true) throw new SearchError('cli_preflight_failed', 'CLI isolation or OAuth-only policy could not be confirmed.');
  for (const key of ['hooks', 'mcpServers', 'plugins', 'lspServers']) {
    if (!Array.isArray(data[key])) throw new SearchError('cli_preflight_failed', 'Unsupported Grok discovery format.');
    if (data[key].length) throw new SearchError('unsafe_cli_integrations', 'Grok discovered executable integrations. Disable them in your own CLI setup before enabling deep search.');
  }
}
export function searchCliArgs(args, model, turns = 4) {
  return ['-p', prompt(args, true), '--model', model, '--output-format', 'json', '--max-turns', String(turns), '--reasoning-effort', 'medium', '--no-subagents', '--no-plan', '--tools', 'x_search', '--disallowed-tools', 'Agent,search_tool,use_tool,run_terminal_cmd,read_file,write_file,search_replace,web_search,web_fetch', '--deny', 'MCPTool', '--deny', 'Bash', '--deny', 'Read', '--deny', 'Edit', '--deny', 'Write', '--permission-mode', 'dontAsk', '--sandbox', 'read-only', '--system-prompt-override', 'Research X using search only. Never access local files, shell, MCP tools or subagents. Cite original posts.'];
}
export async function checkDeepExecutable(settings) {
  const executable = resolveCli(settings);
  try { await access(executable, constants.X_OK); } catch { throw new SearchError('cli_unavailable', 'Grok CLI is not executable.'); }
  return executable;
}
export async function deepSearch(args, { settings, credentials, signal, run = runCli } = {}) {
  if (settings.auth !== 'oauth' || !settings.enableDeep) throw new SearchError('deep_disabled', 'Deep search requires explicit OAuth mode and --enable-deep.');
  const a = validate(args), started = performance.now();
  checkCancelled(signal); await credentials.get(); checkCancelled(signal);
  const cwd = await temporaryDirectory(settings.tempRoot);
  try {
    await readSession(settings, credentials.redactor);
    const inspection = await run(settings, ['inspect', '--json'], { cwd, redactor: credentials.redactor, signal });
    let discovered;
    try { discovered = JSON.parse(inspection.stdout); } catch { throw new SearchError('cli_preflight_failed', 'Grok inspect did not return supported JSON.'); }
    assertSafeInspection(discovered); checkCancelled(signal);
    const output = await run(settings, searchCliArgs(a, settings.model, settings.deepMaxTurns), { cwd, redactor: credentials.redactor, signal, inference: true, timeout: settings.deepTimeoutMs });
    let data;
    try { data = JSON.parse(output.stdout); } catch { throw new SearchError('invalid_cli_response', 'Grok CLI returned invalid JSON; no retry.'); }
    if (data.type === 'error' || typeof data.text !== 'string' || !data.text) throw new SearchError('cli_error', 'Grok CLI returned no usable answer; no retry.');
    return credentials.redactor.object({ ...result(data.text, data.text, 'cli', settings.model, started), auth_mode: 'oauth', usage: usageSummary(data.usage), stop_reason: data.stopReason || 'unknown', incomplete: data.stopReason !== 'end_turn', model_rounds: data.num_turns ?? null, constraints_mode: 'prompt_guidance', cli_cwd_isolated: true });
  } finally { await cleanup(cwd, settings.tempRoot); }
}
