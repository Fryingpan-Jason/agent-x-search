import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
const root = process.env.AGENT_TEST_ROOT || fileURLToPath(new URL('../', import.meta.url));
const { serve } = await import(pathToFileURL(join(root, 'src/transport.mjs')));
const { directSearch } = await import(pathToFileURL(join(root, 'src/search.mjs')));
const search = async (a, o) => {
  const value = await directSearch(a, { ...o, model: 'grok-4.6', authMode: 'api-key', credential: async () => ({ key: 'fixture-token-DO-NOT-LOG', authMode: 'api-key', headers: {} }), fetchImpl: async () => new Response(JSON.stringify({ status: 'completed', output_text: 'Offline evidence https://x.com/example/status/123', usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } })) });
  return process.env.AGENT_BENCH === '1' ? { ...value, benchmark_rss_bytes: process.memoryUsage().rss } : value;
};
serve({ search, deep: search, enableDeep: process.argv.includes('--enable-deep') });
