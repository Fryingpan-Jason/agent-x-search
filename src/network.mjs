import { SearchError } from './settings.mjs';
import { ENDPOINT, API_ENDPOINT, transportReason } from './search.mjs';

function validateProxy(value) {
  if (typeof value !== 'string' || /[\r\n\0]/.test(value)) throw new SearchError('invalid_configuration', 'Invalid proxy URL.');
  let url;
  try { url = new URL(value); } catch { throw new SearchError('invalid_configuration', 'Proxy must be an absolute HTTP(S) URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) throw new SearchError('invalid_configuration', 'Proxy must be an HTTP(S) endpoint without a path, query or fragment.');
  if (url.username || url.password) throw new SearchError('invalid_configuration', 'Proxy credentials are not exported. Configure authenticated proxies using your client secret/environment settings.');
  return url.origin;
}
export function proxyEnvironment(settings, env = process.env) {
  if (!settings.proxy && !settings.proxyFromEnv) return undefined;
  const http = settings.proxy ?? (env.http_proxy || env.HTTP_PROXY);
  const https = settings.proxy ?? (env.https_proxy || env.HTTPS_PROXY);
  if (!http && !https) throw new SearchError('invalid_configuration', 'No HTTP_PROXY or HTTPS_PROXY found. ALL_PROXY alone is not supported; specify --proxy with an HTTP(S) proxy.');
  // Mirrored casing prevents inherited lowercase values from overriding the explicit selection.
  const selected = {};
  if (http) selected.HTTP_PROXY = selected.http_proxy = validateProxy(http);
  if (https) selected.HTTPS_PROXY = selected.https_proxy = validateProxy(https);
  const noProxy = settings.proxyFromEnv ? (env.no_proxy ?? env.NO_PROXY ?? '') : 'localhost,127.0.0.1,::1';
  if (typeof noProxy !== 'string' || noProxy.length > 2048 || /[\r\n\0]/.test(noProxy)) throw new SearchError('invalid_configuration', 'Invalid NO_PROXY value.');
  selected.NO_PROXY = selected.no_proxy = noProxy;
  return selected;
}
export async function networkCheck(settings, { fetchImpl = fetch, timeoutMs = 15_000 } = {}) {
  const started = performance.now();
  const endpoint = new URL('models', settings.auth === 'api-key' ? API_ENDPOINT : ENDPOINT).href;
  try {
    // A single unauthenticated metadata GET; never reuse search credentials or issue inference.
    const response = await fetchImpl(endpoint, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
    await response.body?.cancel().catch(() => {});
    return { name: 'network', ok: response.ok || response.status === 401, reachable: true, http_status: response.status, elapsed_ms: Math.round(performance.now() - started), message: response.status === 401 ? 'Endpoint reached; unauthenticated HTTP 401 is expected. This does not validate your login.' : `Endpoint returned HTTP ${response.status}; credentials were not sent.` };
  } catch (error) {
    return { name: 'network', ok: false, reachable: false, cause_code: transportReason(error), elapsed_ms: Math.round(performance.now() - started), message: 'Connection failed. If this network requires a proxy, pass its variables explicitly to the MCP process. No search was sent.' };
  }
}
