'use strict';
// 内置工具定义与执行器（文件访问默认限制在项目目录内）
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getSettings } = require('./settings');

const isWin = process.platform === 'win32';

function safeResolve(projectPath, p) {
  const root = path.resolve(projectPath);
  const target = path.resolve(root, p || '.');
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error('路径超出项目目录：' + p + '（项目根目录：' + root + '）');
  }
  return target;
}

function buildToolDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'run_command',
        description: '在项目目录（或指定子目录）中执行 shell 命令并返回输出。Windows 使用 PowerShell。适合构建、测试、安装依赖、git 操作等。',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: '要执行的完整命令' },
            workdir: { type: 'string', description: '可选，相对项目根目录的工作目录' },
            timeoutMs: { type: 'integer', description: '可选，超时毫秒数（默认 60000）' }
          },
          required: ['command']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: '读取项目内文本文件内容。',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '相对项目根目录的文件路径' },
            offset: { type: 'integer', description: '可选，起始行号（1 开始）' },
            limit: { type: 'integer', description: '可选，最多返回行数（默认 400）' }
          },
          required: ['path']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'write_file',
        description: '写入或追加文本到项目内文件（自动创建父目录）。',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '相对项目根目录的文件路径' },
            content: { type: 'string', description: '要写入的内容' },
            append: { type: 'boolean', description: '可选，true 表示追加' }
          },
          required: ['path', 'content']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'list_dir',
        description: '列出项目内目录的内容（名称 + 类型 + 大小）。',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '相对项目根目录的目录路径（默认根目录）' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'grep',
        description: '在项目文件中搜索文本（正则）。',
        parameters: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: '正则表达式' },
            path: { type: 'string', description: '搜索起点（相对项目根目录）' },
            include: { type: 'string', description: '可选，文件类型过滤，如 *.js' }
          },
          required: ['pattern']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'web_fetch',
        description: '抓取一个网页/接口的文本内容（用于查文档、看 README 等），最多约 20 万字符。',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'http(s) 网址' }
          },
          required: ['url']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_project_info',
        description: '获取项目概览：目录树（2 层）、README/package.json 等关键文件内容，帮助快速了解项目。',
        parameters: { type: 'object', properties: {} }
      }
    }
  ];
}

async function execute(name, args, opts) {
  const projectPath = opts.projectPath;
  switch (name) {
    case 'run_command': return runCommand(args, projectPath);
    case 'read_file': return readFile(args, projectPath);
    case 'write_file': return writeFile(args, projectPath);
    case 'list_dir': return listDir(args, projectPath);
    case 'grep': return grep(args, projectPath);
    case 'web_fetch': return webFetch(args);
    case 'get_project_info': return projectInfo(projectPath);
    default:
      if (opts.onExternal) return opts.onExternal(name, args);
      throw new Error('未知工具：' + name);
  }
}

function runCommand(args, projectPath) {
  return new Promise((resolve, reject) => {
    const settings = getSettings();
    const timeout = Number(args.timeoutMs) || settings.agent.shellTimeoutMs || 60000;
    const cwd = args.workdir ? safeResolve(projectPath, args.workdir) : path.resolve(projectPath);
    if (!fs.existsSync(cwd)) return reject(new Error('工作目录不存在：' + cwd));
    const cmd = isWin ? 'powershell.exe' : 'bash';
    const argv = isWin ? ['-NoProfile', '-NonInteractive', '-Command', args.command] : ['-c', args.command];
    execFile(cmd, argv, { cwd, timeout, maxBuffer: 8 * 1024 * 1024, env: process.env, windowsHide: true }, (err, stdout, stderr) => {
      const code = err ? (typeof err.code === 'number' ? err.code : 1) : 0;
      resolve({
        exitCode: code,
        stdout: (stdout || '').slice(0, 60000),
        stderr: (stderr || '').slice(0, 20000),
        error: err && !err.killed ? err.message.slice(0, 500) : undefined
      });
    });
  });
}

function readFile(args, projectPath) {
  const target = safeResolve(projectPath, args.path);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) throw new Error('文件不存在：' + args.path);
  const lines = fs.readFileSync(target, 'utf8').split('\n');
  const offset = Math.max(1, Number(args.offset) || 1);
  const limit = Math.min(2000, Number(args.limit) || 400);
  const slice = lines.slice(offset - 1, offset - 1 + limit);
  return { content: slice.join('\n'), totalLines: lines.length, fromLine: offset, toLine: offset + slice.length - 1 };
}

function writeFile(args, projectPath) {
  const target = safeResolve(projectPath, args.path);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (args.append) fs.appendFileSync(target, args.content, 'utf8');
  else fs.writeFileSync(target, args.content, 'utf8');
  return { ok: true, path: args.path, bytes: Buffer.byteLength(args.content, 'utf8'), append: !!args.append };
}

function listDir(args, projectPath) {
  const target = safeResolve(projectPath, args.path || '.');
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) throw new Error('目录不存在：' + (args.path || '.'));
  const entries = fs.readdirSync(target).map((n) => {
    let st = null;
    try { st = fs.statSync(path.join(target, n)); } catch (e) { /* 无权限等 */ }
    return st ? { name: n, type: st.isDirectory() ? 'dir' : 'file', size: st.isDirectory() ? null : st.size } : { name: n, type: 'unknown', size: null };
  });
  return { path: args.path || '.', entries: entries.slice(0, 500) };
}

function grep(args, projectPath) {
  const base = safeResolve(projectPath, args.path || '.');
  const pattern = new RegExp(args.pattern, 'i');
  const include = args.include ? new RegExp('^' + args.include.replace(/\*/g, '.*') + '$', 'i') : null;
  const hits = [];
  const skipDirs = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'target', 'out', '.venv', 'venv', '__pycache__', '.idea', '.vscode']);
  function walk(dir, depth) {
    if (depth > 8 || hits.length >= 200) return;
    let names = [];
    try { names = fs.readdirSync(dir); } catch (e) { return; }
    for (const n of names) {
      const fp = path.join(dir, n);
      let st = null;
      try { st = fs.statSync(fp); } catch (e) { continue; }
      if (st.isDirectory()) {
        if (skipDirs.has(n)) continue;
        walk(fp, depth + 1);
      } else if (st.isFile() && st.size < 1024 * 1024) {
        if (include && !include.test(n)) continue;
        try {
          const text = fs.readFileSync(fp, 'utf8');
          const lines = text.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (pattern.test(lines[i])) {
              hits.push({ file: path.relative(projectPath, fp), line: i + 1, text: lines[i].slice(0, 300) });
              if (hits.length >= 200) return;
            }
          }
        } catch (e) { /* 二进制等 */ }
      }
    }
  }
  walk(base, 0);
  return { pattern: args.pattern, hits: hits.slice(0, 200) };
}

async function webFetch(args) {
  const url = String(args.url || '').trim();
  if (!/^https?:\/\//i.test(url)) throw new Error('仅支持 http/https 网址');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 DeepSeek-Harness-Desktop/1.0' } });
    const buf = Buffer.from(await res.arrayBuffer());
    let text = buf.toString('utf8').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
    text = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length > 200000) text = text.slice(0, 200000) + '\n…（内容过长已截断）';
    return { url, status: res.status, contentType: res.headers.get('content-type') || '', text: text.slice(0, 200000) };
  } finally {
    clearTimeout(timer);
  }
}

function projectInfo(projectPath) {
  const root = path.resolve(projectPath);
  const out = { root, name: path.basename(root), tree: [], files: {} };
  function walk(dir, depth) {
    if (depth > 2 || out.tree.length >= 120) return;
    let names = [];
    try { names = fs.readdirSync(dir); } catch (e) { return; }
    for (const n of names) {
      const fp = path.join(dir, n);
      let st = null;
      try { st = fs.statSync(fp); } catch (e) { continue; }
      const rel = path.relative(root, fp);
      if (st.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'build', 'out', '.next', 'target', '.venv'].includes(n)) continue;
        out.tree.push(rel + '/');
        walk(fp, depth + 1);
      } else {
        if (st.size < 64 * 1024 && /\.(md|txt|json|yaml|yml|toml|js|ts|tsx|py|go|c|h|cpp|java|rs|vue|html|css)$/i.test(n)) {
          out.tree.push(rel);
          if (['README.md', 'readme.md', 'package.json', 'Cargo.toml', 'go.mod', 'pyproject.toml', 'requirements.txt', 'pom.xml', '.env.example'].includes(n) && out.files[rel] === undefined) {
            try { out.files[rel] = fs.readFileSync(fp, 'utf8').slice(0, 8000); } catch (e) { /* 忽略 */ }
          }
        } else {
          out.tree.push(rel + ' (' + st.size + 'B)');
        }
      }
    }
  }
  walk(root, 0);
  return out;
}

module.exports = { buildToolDefinitions, execute, safeResolve, isWin };
