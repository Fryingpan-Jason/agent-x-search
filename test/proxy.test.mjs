import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSettings } from '../src/settings.mjs';
import { CLIENTS, clientConfig, doctor } from '../src/command.mjs';
import { proxyEnvironment, networkCheck } from '../src/network.mjs';

const settings = (...args) => parseSettings(args, {});
test('proxy export is opt-in and uses each client environment field', () => {
  for (const client of CLIENTS) {
    const base = settings('config', '--client', client);
    assert.equal(clientConfig(base, { env: { HTTPS_PROXY: 'http://localhost:9999' } }), clientConfig(base, { env: {} }));
    const output = clientConfig({ ...base, proxy: 'http://localhost:9999' });
    if (client === 'codex') assert.match(output, /\[mcp_servers.agent-x-search.env\][\s\S]*\nHTTP_PROXY = "http:\/\/localhost:9999"/);
    else {
      const parsed = JSON.parse(output);
      const transport = (parsed.mcp || parsed.servers || parsed.mcpServers)['agent-x-search'];
      const env = client === 'opencode' ? transport.environment : transport.env;
      assert.equal(env.HTTPS_PROXY, 'http://localhost:9999');
      assert.equal(env.https_proxy, env.HTTPS_PROXY);
    }
  }
});
test('environment export honors precedence and excludes secrets', () => {
  const env = { https_proxy: 'http://localhost:8888', HTTPS_PROXY: 'http://localhost:9999', NO_PROXY: 'example.test', ALL_PROXY: 'socks5://localhost:7777' };
  Object.defineProperty(env, 'XAI_API_KEY', { get() { throw Error('must not read key'); } });
  assert.deepEqual(proxyEnvironment({ proxyFromEnv: true }, env), { HTTPS_PROXY: 'http://localhost:8888', https_proxy: 'http://localhost:8888', NO_PROXY: 'example.test', no_proxy: 'example.test' });
  for (const proxy of ['socks5://localhost:9999', 'http://user:private-password@localhost:9999', 'http://localhost/path', 'http://local\nhost']) {
    assert.throws(() => proxyEnvironment({ proxy }), error => error.code === 'invalid_configuration' && !error.message.includes('private-password'));
  }
  assert.throws(() => proxyEnvironment({ proxyFromEnv: true }, { ALL_PROXY: 'socks5://localhost:7777' }), /ALL_PROXY/);
});
test('diagnostic and export options reject conflicting commands', () => {
  for (const args of [['serve', '--proxy', 'http://localhost'], ['serve', '--network'], ['config', '--proxy', 'http://localhost', '--proxy-from-env']]) assert.throws(() => settings(...args), /only|for config|not both/);
});
test('doctor stays offline by default; network check is one credential-free metadata GET', async () => {
  let calls = 0;
  const fetchImpl = async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.x.ai/v1/models');
    assert.equal(options.method, 'GET');
    assert.equal(options.headers, undefined);
    assert.equal(options.body, undefined);
    assert.equal(options.redirect, 'error');
    return new Response(null, { status: 401 });
  };
  const base = settings('doctor', '--auth', 'api-key');
  await doctor(base, { XAI_API_KEY: 'fake-test-key' }, { fetchImpl });
  assert.equal(calls, 0);
  const report = await doctor({ ...base, network: true }, { XAI_API_KEY: 'fake-test-key' }, { fetchImpl });
  assert.equal(calls, 1);
  assert.equal(report.inference_requests, 0);
  assert.equal(report.checks.at(-1).ok, true);
  const failed = await networkCheck({ auth: 'oauth' }, { fetchImpl: async url => {
    assert.equal(url, 'https://cli-chat-proxy.grok.com/v1/models');
    throw new TypeError('private-token', { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } });
  } });
  assert.equal(failed.cause_code, 'UND_ERR_CONNECT_TIMEOUT');
  assert.ok(!JSON.stringify(failed).includes('private-token'));
  const denied = await networkCheck(base, { fetchImpl: async () => new Response(null, { status: 403 }) });
  assert.equal(denied.reachable, true);
  assert.equal(denied.ok, false);
});
test('generated proxy survives the SDK minimal environment in a real Node child', { timeout: 10000 }, async t => {
  const urls = [];
  const tunnels = [];
  const sockets = new Set();
  const proxy = createServer((req, res) => { urls.push(req.url); res.writeHead(401); res.end(); });
  // Node versions may tunnel HTTP through CONNECT or send an absolute-form request.
  proxy.on('connect', (req, socket, head) => {
    tunnels.push(req.url);
    const upstream = connect(proxy.address().port, '127.0.0.1', () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    for (const stream of [socket, upstream]) {
      sockets.add(stream);
      stream.on('error', () => { socket.destroy(); upstream.destroy(); });
      stream.on('close', () => sockets.delete(stream));
    }
  });
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
  t.after(() => { for (const socket of sockets) socket.destroy(); proxy.closeAllConnections(); proxy.close(); });
  const config = JSON.parse(clientConfig(settings('config', '--client', 'cursor', '--proxy', `http://127.0.0.1:${proxy.address().port}`)));
  const { stdout } = await promisify(execFile)(process.execPath, ['--use-env-proxy', '--input-type=module', '-e', 'const r = await fetch("http://agent-x-search.invalid/probe"); console.log(r.status); await r.body.cancel();'], {
    env: { ...getDefaultEnvironment(), ...config.mcpServers['agent-x-search'].env }, timeout: 5000,
  });
  assert.equal(stdout.trim(), '401');
  if (tunnels.length) {
    assert.deepEqual(tunnels, ['agent-x-search.invalid:80']);
    assert.deepEqual(urls, ['/probe']);
  } else assert.deepEqual(urls, ['http://agent-x-search.invalid/probe']);
});
