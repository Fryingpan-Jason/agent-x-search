import { homedir, tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { existsSync } from 'node:fs';

export const VERSION = '0.1.0';
export class SearchError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const bad = message => { throw new SearchError('invalid_configuration', message); };
export function parseSettings(argv = [], env = process.env) {
  const values = {}, bool = new Set(['enable-deep', 'help', 'version', 'local', 'proxy-from-env', 'network']);
  const names = new Set(['auth', 'model', 'grok-home', 'grok-cli', 'temp-dir', 'client', 'proxy']);
  let command = 'serve';
  if (argv[0] && !argv[0].startsWith('-')) { command = argv[0]; argv = argv.slice(1); }
  if (!['serve', 'doctor', 'config'].includes(command)) bad('Expected serve, doctor, or config.');
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || (!bool.has(key) && !names.has(key))) bad('Unknown option. Use --help.');
    if (bool.has(key)) values[key] = true;
    else {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) bad('Option requires a value.');
      values[key] = argv[++i];
    }
  }
  const deepEnv = env.AGENT_X_SEARCH_ENABLE_DEEP;
  if ((values.proxy !== undefined || values['proxy-from-env']) && command !== 'config') bad('Proxy options are for config; set proxy environment variables when running serve or doctor.');
  if (values.proxy !== undefined && values['proxy-from-env']) bad('Choose --proxy or --proxy-from-env, not both.');
  if (values.network && command !== 'doctor') bad('--network is only available with doctor.');
  if (deepEnv !== undefined && !['0', '1', 'false', 'true'].includes(deepEnv)) bad('AGENT_X_SEARCH_ENABLE_DEEP must be 0, 1, false, or true.');
  const settings = {
    command, help: !!values.help, version: !!values.version, client: values.client, local: !!values.local,
    proxy: values.proxy, proxyFromEnv: !!values['proxy-from-env'], network: !!values.network,
    auth: values.auth ?? env.AGENT_X_SEARCH_AUTH ?? 'oauth',
    model: values.model ?? env.AGENT_X_SEARCH_MODEL ?? 'grok-4.6',
    enableDeep: values['enable-deep'] ?? ['1', 'true'].includes(deepEnv),
    grokHome: values['grok-home'] ?? env.AGENT_X_SEARCH_GROK_HOME ?? env.GROK_HOME ?? join(homedir(), '.grok'),
    cliOverride: values['grok-cli'] ?? env.AGENT_X_SEARCH_GROK_CLI,
    tempRoot: values['temp-dir'] ?? env.AGENT_X_SEARCH_TEMP_DIR ?? join(tmpdir(), 'agent-x-search'),
    timeoutMs: 120_000, deepTimeoutMs: 240_000, deepMaxTurns: 4,
  };
  if (!['oauth', 'api-key'].includes(settings.auth)) bad('Auth must be oauth or api-key.');
  if (settings.auth === 'api-key' && settings.enableDeep) bad('--enable-deep requires --auth oauth; billing modes never switch automatically.');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(settings.model)) bad('Invalid model identifier.');
  for (const p of [settings.grokHome, settings.tempRoot, settings.cliOverride].filter(Boolean)) if (!isAbsolute(p)) bad('Path overrides must be absolute.');
  return settings;
}
export function resolveCli(settings, { platform = process.platform, env = process.env, exists = existsSync } = {}) {
  const name = platform === 'win32' ? 'grok.exe' : 'grok';
  const separator = platform === 'win32' ? ';' : ':';
  const candidates = settings.cliOverride ? [settings.cliOverride] : [join(settings.grokHome, 'bin', name), ...(env.PATH || env.Path || '').split(separator).filter(Boolean).map(dir => join(dir, name))];
  const path = candidates.find(exists);
  if (!path) throw new SearchError('cli_unavailable', 'Official Grok CLI not found. Install it or set --grok-cli to its absolute path.');
  return path;
}
export function checkNode(version = process.versions.node) {
  const [major, minor] = version.split('.').map(Number);
  if (major < 24 || (major === 24 && minor < 5)) bad('Node.js 24.5 or newer is required.');
}
