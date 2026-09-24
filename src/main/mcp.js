'use strict';
// 极简 MCP stdio 客户端（JSON-RPC over stdio，换行分隔）
const { spawn } = require('child_process');
const crypto = require('crypto');
const { readJson, writeJson } = require('./store');

const runtime = new Map(); // id -> { proc, buf, pending }

function listServers() {
  const arr = readJson('mcp.json', []);
  return arr.map((s) => {
    const rt = runtime.get(s.id);
    return {
      ...s,
      status: rt ? 'running' : 'stopped',
      tools: (rt && rt.tools) || []
    };
  });
}

function saveServers(arr) {
  const clean = arr.map((s) => {
    const { status, tools, ...rest } = s;
    return rest;
  });
  writeJson('mcp.json', clean);
}

function parseCommandLine(line) {
  // 简单按引号切分命令行
  const out = [];
  let cur = '';
  let inQ = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === inQ) inQ = null;
      else cur += c;
    } else if (c === '"' || c === "'") {
      inQ = c;
    } else if (c === ' ' || c === '\t') {
      if (cur) { out.push(cur); cur = ''; }
    } else {
      cur += c;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function startServer(srv) {
  const existing = runtime.get(srv.id);
  if (existing) return existing.tools;
  return new Promise((resolve, reject) => {
    const parts = parseCommandLine(srv.command || '');
    if (!parts.length) return reject(new Error('命令不能为空'));
    let proc;
    try {
      proc = spawn(parts[0], parts.slice(1), {
        cwd: srv.cwd || undefined,
        env: { ...process.env, ...(srv.env || {}) },
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        shell: false
      });
    } catch (e) {
      return reject(new Error('启动 MCP 服务器失败：' + e.message));
    }
    const rt = { proc, buf: '', pending: new Map(), tools: [], nextId: 1 };
    runtime.set(srv.id, rt);
    const errParts = [];
    proc.stderr.on('data', (d) => {
      const s = d.toString();
      if (errParts.length < 5) errParts.push(s.slice(0, 400));
    });
    proc.stdout.on('data', (d) => {
      rt.buf += d.toString();
      let idx;
      while ((idx = rt.buf.indexOf('\n')) >= 0) {
        const line = rt.buf.slice(0, idx).trim();
        rt.buf = rt.buf.slice(idx + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch (e) { continue; }
        if (msg.id !== undefined && rt.pending.has(msg.id)) {
          const p = rt.pending.get(msg.id);
          rt.pending.delete(msg.id);
          clearTimeout(p.timer);
          if (msg.error) p.reject(new Error((msg.error.message || 'MCP 错误') + (msg.error.data ? ' ' + JSON.stringify(msg.error.data).slice(0, 300) : '')));
          else p.resolve(msg.result);
        }
      }
    });
    proc.on('exit', () => {
      const rt2 = runtime.get(srv.id);
      if (rt2) {
        for (const [, p] of rt2.pending) { clearTimeout(p.timer); p.reject(new Error('MCP 服务器已退出')); }
        runtime.delete(srv.id);
      }
    });
    proc.on('error', (e) => {
      const rt2 = runtime.get(srv.id);
      if (rt2) {
        for (const [, p] of rt2.pending) { clearTimeout(p.timer); p.reject(e); }
        runtime.delete(srv.id);
      }
      reject(e);
    });

    request(srv.id, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'deepseek-harness-desktop', version: '1.0.0' }
    }, 15000)
      .then(() => notify(srv.id, 'notifications/initialized'))
      .then(() => request(srv.id, 'tools/list', {}, 15000))
      .then((result) => {
        rt.tools = (result && result.tools) || [];
        resolve(rt.tools);
      })
      .catch((e) => {
        stopServer(srv.id);
        reject(e);
      });
  });
}

function request(id, method, params, timeoutMs) {
  const rt = runtime.get(id);
  if (!rt) return Promise.reject(new Error('MCP 服务器未运行'));
  const reqId = rt.nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      rt.pending.delete(reqId);
      reject(new Error('MCP 请求超时：' + method));
    }, timeoutMs || 20000);
    rt.pending.set(reqId, { resolve, reject, timer });
    const line = JSON.stringify({ jsonrpc: '2.0', id: reqId, method, params }) + '\n';
    rt.proc.stdin.write(line, (e) => {
      if (e) {
        clearTimeout(timer);
        rt.pending.delete(reqId);
        reject(e);
      }
    });
  });
}

function notify(id, method) {
  const rt = runtime.get(id);
  if (!rt) return;
  rt.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n');
}

function stopServer(id) {
  const rt = runtime.get(id);
  if (!rt) return;
  try { rt.proc.kill(); } catch (e) { /* 忽略 */ }
  runtime.delete(id);
}

async function testServer(srv) {
  const tools = await startServer(srv);
  return { ok: true, tools };
}

async function callTool(serverId, toolName, args) {
  const result = await request(serverId, 'tools/call', { name: toolName, arguments: args || {} }, 60000);
  const text = (result.content || [])
    .map((c) => (c.type === 'text' ? c.text : c.type === 'image' ? '[图片]' : JSON.stringify(c)))
    .join('\n');
  return { ok: !result.isError, text: text.slice(0, 60000) };
}

function getMcpToolDefinitions() {
  const defs = [];
  for (const s of listServers()) {
    if (s.enabled === false) continue;
    const rt = runtime.get(s.id);
    if (!rt || !rt.tools) continue;
    for (const t of rt.tools) {
      defs.push({
        type: 'function',
        function: {
          name: 'mcp__' + s.id + '__' + t.name,
          description: (t.description || ('调用 MCP 服务器「' + s.name + '」的工具 ' + t.name)) + '（来自 MCP 服务器：' + s.name + '）',
          parameters: t.inputSchema || { type: 'object', properties: {} }
        }
      });
    }
  }
  return defs;
}

function upsert(server) {
  const arr = listServers();
  const idx = arr.findIndex((s) => s.id === server.id);
  if (idx >= 0) arr[idx] = { ...arr[idx], ...server };
  else arr.push(server);
  saveServers(arr);
  return server;
}

function add(server) {
  const id = server.id || crypto.randomUUID().slice(0, 8);
  const s = { id, name: server.name, command: server.command, argsLine: server.argsLine || '', cwd: server.cwd || '', env: server.env || {}, enabled: server.enabled !== false };
  saveServers([...listServers(), s]);
  return s;
}

function remove(id) {
  stopServer(id);
  saveServers(listServers().filter((s) => s.id !== id));
}

function setEnabled(id, enabled) {
  const arr = listServers();
  const s = arr.find((x) => x.id === id);
  if (s) {
    s.enabled = enabled;
    saveServers(arr);
    if (!enabled) stopServer(id);
  }
}

module.exports = { listServers, add, remove, upsert, setEnabled, startServer, stopServer, testServer, callTool, getMcpToolDefinitions, runtime };
