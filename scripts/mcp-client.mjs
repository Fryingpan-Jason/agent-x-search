import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export function client(entry = fileURLToPath(new URL('../src/server.mjs', import.meta.url)), env = process.env, launch) {
  const child = spawn(launch?.command || process.execPath, launch?.args || ['--use-env-proxy', entry], { env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let next = 1, buffer = '', stdout = '', stderr = '';
  const waits = new Map();
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', s => {
    stdout += s; buffer += s;
    let i;
    while ((i = buffer.indexOf('\n')) >= 0) { const line = buffer.slice(0, i); buffer = buffer.slice(i + 1); const data = JSON.parse(line); const w = waits.get(data.id); if (w) { waits.delete(data.id); clearTimeout(w.timer); w.resolve(data); } }
  });
  child.stderr.on('data', s => stderr += s);
  child.on('close', () => { for (const w of waits.values()) { clearTimeout(w.timer); w.reject(new Error('Server closed')); } });
  const request = (method, params = {}) => new Promise((resolve, reject) => { const id = next++; const timer = setTimeout(() => { waits.delete(id); reject(new Error('MCP response timeout')); child.kill(); }, 270_000); waits.set(id, { resolve, reject, timer }); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
  return { request, notify: (method, params = {}) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n'), close: () => child.stdin.end(), logs: () => ({ stdout, stderr }) };
}
