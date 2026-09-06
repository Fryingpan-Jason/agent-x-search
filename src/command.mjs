import { fileURLToPath } from 'node:url';
import { parseSettings, checkNode, SearchError, resolveCli, VERSION } from './settings.mjs';
import { readSession, subscriptionVersion, Redactor } from './credentials.mjs';
import { startServer } from './runtime.mjs';

export const CLIENTS = ['codex', 'claude-code', 'cursor', 'vscode', 'opencode', 'cline'];
export function clientConfig(settings, { node = process.execPath, entry = fileURLToPath(new URL('../bin/agent-x-search.mjs', import.meta.url)) } = {}) {
  if (!CLIENTS.includes(settings.client)) throw new SearchError('invalid_configuration', `Choose --client ${CLIENTS.join(', ')}.`);
  const options = ['serve', '--auth', settings.auth, '--model', settings.model];
  if (settings.enableDeep) options.push('--enable-deep');
  for (const [flag, value] of [['--grok-home', settings.grokHome], ['--grok-cli', settings.cliOverride], ['--temp-dir', settings.tempRoot]]) {
    // Only local config contains this machine's resolved paths. Portable configs use defaults.
    if (settings.local && value) options.push(flag, value);
  }
  const command = settings.local ? node : 'npx';
  const args = settings.local ? ['--use-env-proxy', entry, ...options] : ['-y', `agent-x-search@${VERSION}`, ...options];
  const transport = { command, args };
  if (settings.client === 'codex') return `[mcp_servers.agent-x-search]\ncommand = ${JSON.stringify(command)}\nargs = ${JSON.stringify(args)}\nenabled_tools = ${JSON.stringify(settings.enableDeep ? ['x_search', 'x_deep_search'] : ['x_search'])}\nstartup_timeout_sec = 30\ntool_timeout_sec = 300\n`;
  if (settings.client === 'opencode') return JSON.stringify({ $schema: 'https://opencode.ai/config.json', mcp: { 'agent-x-search': { type: 'local', command: [command, ...args], enabled: true, timeout: 300_000 } } }, null, 2) + '\n';
  if (settings.client === 'vscode') return JSON.stringify({ servers: { 'agent-x-search': { type: 'stdio', ...transport } } }, null, 2) + '\n';
  return JSON.stringify({ mcpServers: { 'agent-x-search': { ...transport, ...(settings.client === 'cline' ? { disabled: false, autoApprove: [], timeout: 300 } : {}) } } }, null, 2) + '\n';
}
export async function doctor(settings, env = process.env) {
  const checks = [{ name: 'runtime', ok: true, message: `Node ${process.versions.node}` }];
  const redactor = new Redactor();
  if (settings.auth === 'api-key') {
    checks.push({ name: 'api-key', ok: typeof env.XAI_API_KEY === 'string' && env.XAI_API_KEY.length >= 8 && !/[\r\n]/.test(env.XAI_API_KEY), message: 'Environment presence only; not validated with xAI. API mode incurs API spend.' });
  } else {
    try { const s = await readSession(settings, redactor); checks.push({ name: 'oauth', ok: Date.parse(s.expires_at) > Date.now() + 60_000, message: 'Existing official session checked locally; not validated with xAI. Expired sessions need official CLI refresh.' }); }
    catch { checks.push({ name: 'oauth', ok: false, message: 'Session unavailable or unsupported. Run official grok login.' }); }
    try { checks.push({ name: 'cli-metadata', ok: true, message: `Cached Grok CLI version ${await subscriptionVersion(settings)}; not a live version probe.` }); }
    catch { checks.push({ name: 'cli-metadata', ok: false, message: 'Missing metadata. Run official grok models.' }); }
    try { resolveCli(settings); checks.push({ name: 'cli', ok: true, message: 'Executable found; no process launched.' }); }
    catch { checks.push({ name: 'cli', ok: !settings.enableDeep, message: 'CLI absent; needed for refresh and optional deep search.' }); }
  }
  return { ok: checks.every(c => c.ok), version: VERSION, auth_mode: settings.auth, model: settings.model, deep_enabled: settings.enableDeep, inference_requests: 0, checks };
}
export async function main(argv = process.argv.slice(2), env = process.env) {
  try {
    checkNode();
    const settings = parseSettings(argv, env);
    if (settings.version) { process.stdout.write(VERSION + '\n'); return; }
    if (settings.help) {
      process.stdout.write('Agent X Search (unofficial)\n\nagent-x-search serve [--auth oauth|api-key] [--model MODEL] [--enable-deep]\nagent-x-search doctor [same options]\nagent-x-search config --client codex|claude-code|cursor|vscode|opencode|cline [--local]\n\nPaths: --grok-home, --grok-cli, --temp-dir (absolute paths).\nAPI mode reads XAI_API_KEY only when explicitly selected. No automatic billing fallback.\n'); return;
    }
    if (settings.command === 'config') { process.stdout.write(clientConfig(settings)); return; }
    if (settings.command === 'doctor') { const report = await doctor(settings, env); process.stdout.write(JSON.stringify(report, null, 2) + '\n'); if (!report.ok) process.exitCode = 1; return; }
    await startServer(settings);
  } catch (e) {
    process.stderr.write(JSON.stringify({ error: e instanceof SearchError ? e.code : 'startup_failed', message: e instanceof SearchError ? e.message : 'Startup failed; check configuration with doctor.' }) + '\n');
    process.exitCode = 1;
  }
}
