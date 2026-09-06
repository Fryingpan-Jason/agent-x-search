import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SearchError, VERSION } from './settings.mjs';

export class Redactor {
  #secrets = new Set();
  add(secret) { if (typeof secret === 'string' && secret.length >= 8) this.#secrets.add(secret); }
  text(value) {
    let text = String(value);
    for (const secret of this.#secrets) text = text.split(secret).join('[REDACTED]');
    return text.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED]');
  }
  object(value) { return JSON.parse(this.text(JSON.stringify(value))); }
}
export async function readSession(settings, redactor) {
  let data;
  try { data = JSON.parse(await readFile(join(settings.grokHome, 'auth.json'), 'utf8')); }
  catch { throw new SearchError('reauth_required', 'Grok OAuth session unavailable. Run official grok login.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new SearchError('reauth_required', 'Unsupported Grok authentication file.');
  for (const item of Object.values(data)) for (const key of ['key', 'refresh_token', 'access_token', 'id_token']) redactor.add(item?.[key]);
  const sessions = Object.values(data).filter(s => s?.auth_mode === 'oidc' && s.oidc_issuer === 'https://auth.x.ai' && typeof s.key === 'string' && s.key.length >= 8);
  if (sessions.length !== 1) throw new SearchError('reauth_required', 'Expected one xAI OAuth session. Resolve account selection with official Grok CLI.');
  return sessions[0];
}
export async function subscriptionVersion(settings) {
  try {
    const cache = JSON.parse(await readFile(join(settings.grokHome, 'models_cache.json'), 'utf8'));
    if (/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(cache.grok_version)) return cache.grok_version;
  } catch {}
  throw new SearchError('cli_metadata_required', 'Grok model cache/version unavailable. Run official grok models, then try again.');
}
export function createCredentials(settings, { env = process.env, redactor = new Redactor(), refresh, read = () => readSession(settings, redactor), now = Date.now } = {}) {
  let refreshPromise;
  async function get() {
    if (settings.auth === 'api-key') {
      const key = env.XAI_API_KEY;
      if (typeof key !== 'string' || key.length < 8 || /[\r\n]/.test(key)) throw new SearchError('api_key_required', 'Set XAI_API_KEY for explicit --auth api-key mode.');
      redactor.add(key);
      return { key, headers: { 'User-Agent': `agent-x-search/${VERSION}` }, authMode: 'api-key' };
    }
    let s = await read();
    if (!(Date.parse(s.expires_at) > now() + 60_000)) {
      try {
        if (!refresh) throw new Error();
        refreshPromise ??= Promise.resolve().then(refresh).finally(() => { refreshPromise = undefined; });
        await refreshPromise; s = await read();
      } catch { throw new SearchError('reauth_required', 'Official OAuth refresh failed. Run grok login manually.'); }
      if (!(Date.parse(s.expires_at) > now() + 60_000)) throw new SearchError('reauth_required', 'Grok OAuth remains expired. Run grok login.');
    }
    redactor.add(s.key);
    return { key: s.key, authMode: 'oauth', headers: { 'User-Agent': `agent-x-search/${VERSION} (${process.platform}; ${process.arch})`, 'X-XAI-Token-Auth': 'xai-grok-cli', 'x-grok-client-version': await subscriptionVersion(settings), 'x-grok-client-identifier': 'agent-x-search', 'x-grok-model-override': settings.model } };
  }
  return { get, redactor };
}
