import { mkdir, mkdtemp, writeFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
export const fixtureKey = 'fixture-access-token-not-a-real-credential';
export const fixtureRefresh = 'fixture-refresh-token-not-a-real-credential';
export async function temporary(t) {
  const base = process.env.AGENT_X_SEARCH_TEST_TMP || join(tmpdir(), 'agent-x-search-tests');
  await mkdir(base, { recursive: true });
  const path = await mkdtemp(join(base, 'case-'));
  t.after(async () => {
    const target = await realpath(path), parent = await realpath(base);
    if (dirname(target) !== parent) throw new Error('Test cleanup path mismatch');
    await rm(target, { recursive: true, force: true });
  });
  return path;
}
export async function fakeHome(t, expired = false) {
  const path = await temporary(t);
  const session = { auth_mode: 'oidc', oidc_issuer: 'https://auth.x.ai', key: fixtureKey, refresh_token: fixtureRefresh, expires_at: expired ? '2000-01-01T00:00:00Z' : '2100-01-01T00:00:00Z' };
  await writeFile(join(path, 'auth.json'), JSON.stringify({ fixture: session }));
  await writeFile(join(path, 'models_cache.json'), JSON.stringify({ grok_version: '9.8.7' }));
  return { path, session };
}
