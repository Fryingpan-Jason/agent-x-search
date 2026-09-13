import { fileURLToPath } from 'node:url';
import { parseSettings, checkNode, SearchError, resolveCli, VERSION } from './settings.mjs';
import { readSession, subscriptionVersion, Redactor } from './credentials.mjs';
import { startServer } from './runtime.mjs';
import { proxyEnvironment, networkCheck } from './network.mjs';

export const CLIENTS = ['codex', 'claude-code', 'cursor', 'vscode', 'opencode', 'cline'];
export function clientConfig(settings, { node = process.execPath, entry = fileURLToPath(new URL('../bin/agent-x-search.mjs', import.meta.url)), env = process.env } = {}) {
  if (!CLIENTS.includes(settings.client)) throw new SearchError('invalid_configuration', `Choose --client ${CLIENTS.join(', ')}.`);
  const options = ['serve', '--auth', settings.auth, '--model', settings.model, '--timeout-ms', String(settings.timeoutMs), '--deep-timeout-ms', String(settings.deepTimeoutMs)];
  if (settings.enableDeep) options.push('--enable-deep');
  for (const [flag, value] of [['--grok-home', settings.grokHome], ['--grok-cli', settings.cliOverride], ['--temp-dir', settings.tempRoot]]) {
    // Only local config contains this machine's resolved paths. Portable configs use defaults.
    if (settings.local && value) options.push(flag, value);
  }
  const command = settings.local ? node : 'npx';
  const args = settings.local ? ['--use-env-proxy', entry, ...options] : ['-y', `agent-x-search@${VERSION}`, ...options];
  const proxyEnv = proxyEnvironment(settings, env);
  const transport = { command, args, ...(proxyEnv ? { env: proxyEnv } : {}) };
  const toolTimeoutMs = Math.max(settings.timeoutMs, settings.enableDeep ? settings.deepTimeoutMs : 0) + 30_000;
  if (settings.client === 'codex') return `[mcp_servers.agent-x-search]\ncommand = ${JSON.stringify(command)}\nargs = ${JSON.stringify(args)}\nenabled_tools = ${JSON.stringify(settings.enableDeep ? ['x_search', 'x_deep_search'] : ['x_search'])}\nstartup_timeout_sec = 30\ntool_timeout_sec = ${Math.ceil(toolTimeoutMs / 1000)}\n` + (proxyEnv ? '\n[mcp_servers.agent-x-search.env]\n' + Object.entries(proxyEnv).map(([key, value]) => `${key} = ${JSON.stringify(value)}`).join('\n') + '\n' : '');
  if (settings.client === 'opencode') return JSON.stringify({ $schema: 'https://opencode.ai/config.json', mcp: { 'agent-x-search': { type: 'local', command: [command, ...args], enabled: true, timeout: toolTimeoutMs, ...(proxyEnv ? { environment: proxyEnv } : {}) } } }, null, 2) + '\n';
  if (settings.client === 'vscode') return JSON.stringify({ servers: { 'agent-x-search': { type: 'stdio', ...transport } } }, null, 2) + '\n';
  return JSON.stringify({ mcpServers: { 'agent-x-search': { ...transport, ...(settings.client === 'cline' ? { disabled: false, autoApprove: [], timeout: Math.ceil(toolTimeoutMs / 1000) } : {}) } } }, null, 2) + '\n';
}
export async function doctor(settings, env = process.env, networkOptions = {}) {
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
  if (settings.network) checks.push(await networkCheck(settings, networkOptions));
  return { ok: checks.every(c => c.ok), version: VERSION, auth_mode: settings.auth, model: settings.model, deep_enabled: settings.enableDeep, inference_requests: 0, network_requested: !!settings.network, proxy_env_present: !!(env.https_proxy || env.HTTPS_PROXY || env.http_proxy || env.HTTP_PROXY), node_proxy_enabled: process.execArgv.includes('--use-env-proxy') || process.env.NODE_USE_ENV_PROXY === '1', checks };
}
export async function main(argv = process.argv.slice(2), env = process.env) {
  try {
    checkNode();
    const settings = parseSettings(argv, env);
    if (settings.version) { process.stdout.write(VERSION + '\n'); return; }
    if (settings.help) {
      process.stdout.write('Agent X Search (unofficial)\n\nagent-x-search serve [--auth oauth|api-key] [--model MODEL] [--enable-deep] [--timeout-ms MS] [--deep-timeout-ms MS]\nagent-x-search doctor [same options] [--network]\nagent-x-search config --client codex|claude-code|cursor|vscode|opencode|cline [--local] [--proxy URL | --proxy-from-env]\n\nTimeouts: --timeout-ms / AGENT_X_SEARCH_TIMEOUT_MS defaults to 300000; --deep-timeout-ms / AGENT_X_SEARCH_DEEP_TIMEOUT_MS defaults to 900000. Both accept 1000-3600000 ms. Generated client configs add a 30-second allowance.\nProxy export is opt-in and never changes system settings. --network sends one unauthenticated metadata GET, no search.\nPaths: --grok-home, --grok-cli, --temp-dir (absolute paths).\nAPI mode reads XAI_API_KEY only when explicitly selected. No automatic billing fallback.\n'); return;
    }
    if (settings.command === 'config') { process.stdout.write(clientConfig(settings, { env })); return; }
    if (settings.command === 'doctor') { const report = await doctor(settings, env); process.stdout.write(JSON.stringify(report, null, 2) + '\n'); if (!report.ok) process.exitCode = 1; return; }
    await startServer(settings);
  } catch (e) {
    process.stderr.write(JSON.stringify({ error: e instanceof SearchError ? e.code : 'startup_failed', message: e instanceof SearchError ? e.message : 'Startup failed; check configuration with doctor.' }) + '\n');
    process.exitCode = 1;
  }
}
