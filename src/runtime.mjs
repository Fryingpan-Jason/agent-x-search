import { createCredentials } from './credentials.mjs';
import { directSearch } from './search.mjs';
import { refreshSession, deepSearch, checkDeepExecutable } from './runner.mjs';
import { serve } from './transport.mjs';

export function createRuntime(settings, dependencies = {}) {
  let credentials;
  credentials = createCredentials(settings, { ...dependencies, refresh: () => refreshSession(settings, credentials.redactor) });
  return {
    credentials,
    search: (a, o) => directSearch(a, { ...o, model: settings.model, authMode: settings.auth, credential: credentials.get, redactor: credentials.redactor, timeoutMs: settings.timeoutMs, fetchImpl: dependencies.fetchImpl }),
    deep: (a, o) => deepSearch(a, { ...o, settings, credentials }),
  };
}
export async function startServer(settings, streams = {}) {
  if (settings.enableDeep) await checkDeepExecutable(settings);
  const runtime = createRuntime(settings);
  const server = serve({ ...streams, search: runtime.search, deep: runtime.deep, redactor: runtime.credentials.redactor, enableDeep: settings.enableDeep });
  const onSignal = () => { server.stop(); process.stdin.destroy(); };
  process.once('SIGINT', onSignal); process.once('SIGTERM', onSignal);
  return server;
}
