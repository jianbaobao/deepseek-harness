'use strict';
const fs = require('fs');
const path = require('path');
const { resolve } = require('./store');
const { getSettings, setSettings } = require('./settings');
const { zipRead } = require('./zip-utils.cjs');

const loaded = new Map(); // pluginId -> { module, tools: Map(toolName -> fn) }
const ctxRef = {};

function pluginsDir() {
  const s = getSettings();
  if (s.paths && s.paths.pluginsDir) return path.resolve(s.paths.pluginsDir);
  return resolve('plugins');
}

function listPlugins() {
  const dir = pluginsDir();
  const out = [];
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { return out; }
  const enabledMap = getSettings().pluginsEnabled || {};
  for (const n of names) {
    const pdir = path.join(dir, n);
    let st = null;
    try { st = fs.statSync(pdir); } catch (e) { continue; }
    if (!st.isDirectory()) continue;
    const pjPath = path.join(pdir, 'plugin.json');
    if (!fs.existsSync(pjPath)) continue;
    try {
      const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
      out.push({
        id: n,
        name: pj.name || n,
        version: pj.version || '0.0.0',
        description: pj.description || '',
        author: pj.author || '',
        main: pj.main || 'index.js',
        enabled: enabledMap[n] !== false,
        tools: loaded.has(n) ? [...loaded.get(n).tools.keys()] : []
      });
    } catch (e) { /* 跳过损坏插件 */ }
  }
  return out;
}

function setEnabled(id, enabled) {
  const s = getSettings();
  const m = s.pluginsEnabled || {};
  m[id] = enabled;
  setSettings({ pluginsEnabled: m });
  if (enabled) {
    try { loadPlugin(id); } catch (e) { /* 留给 UI 显示错误 */ }
  }
  return enabled ? true : unloadPlugin(id);
}

function unloadPlugin(id) {
  const prev = loaded.get(id);
  if (prev && prev.module && prev.module.deactivate) {
    try { prev.module.deactivate(); } catch (e) { /* 忽略 */ }
  }
  loaded.delete(id);
  return true;
}

function createCtx(pluginId) {
  return {
    pluginId,
    log: (...args) => console.log('[插件:' + pluginId + ']', ...args),
    registerTool: (toolDef, fn) => {
      const rec = loaded.get(pluginId);
      if (!rec) throw new Error('插件未加载');
      if (!toolDef || !toolDef.name || typeof fn !== 'function') throw new Error('registerTool 需要 {name, description, parameters} 与函数');
      rec.tools.set(toolDef.name, { def: toolDef, fn });
      rec.schema.set(toolDef.name, {
        type: 'function',
        function: {
          name: 'plugin__' + pluginId + '__' + toolDef.name,
          description: toolDef.description || '',
          parameters: toolDef.parameters || { type: 'object', properties: {} }
        }
      });
    },
    getSettings: () => getSettings()
  };
}

function loadPlugin(id) {
  const dir = pluginsDir();
  const pdir = path.join(dir, id);
  const pjPath = path.join(pdir, 'plugin.json');
  if (!fs.existsSync(pjPath)) throw new Error('插件目录中没有 plugin.json');
  const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
  const main = path.join(pdir, pj.main || 'index.js');
  if (!fs.existsSync(main)) throw new Error('插件入口不存在：' + (pj.main || 'index.js'));
  unloadPlugin(id);
  delete require.cache[require.resolve(main)];
  const mod = require(main);
  const rec = { module: mod, tools: new Map(), schema: new Map() };
  loaded.set(id, rec);
  if (typeof mod.activate === 'function') {
    mod.activate(createCtx(id));
  }
  return { id, tools: [...rec.tools.keys()] };
}

function loadAllEnabled() {
  for (const p of listPlugins()) {
    if (p.enabled) {
      try { loadPlugin(p.id); } catch (e) { console.error('插件加载失败：' + p.id, e.message); }
    }
  }
}

function getPluginToolDefinitions() {
  const defs = [];
  for (const [, rec] of loaded) {
    for (const d of rec.schema.values()) defs.push(d);
  }
  return defs;
}

async function callPluginTool(fullName, args) {
  // fullName: plugin__<id>__<tool>
  const m = /^plugin__(.+?)__(.+)$/.exec(fullName);
  if (!m) throw new Error('无效的插件工具名：' + fullName);
  const rec = loaded.get(m[1]);
  if (!rec || !rec.tools.has(m[2])) throw new Error('插件或工具未加载：' + m[1] + '/' + m[2]);
  return rec.tools.get(m[2])(args || {});
}

function importZip(zipPath) {
  const buf = fs.readFileSync(zipPath);
  const entries = zipRead(buf);
  const dir = pluginsDir();
  const roots = new Set();
  for (const e of entries) {
    if (e.name.includes('__MACOSX') || e.name.includes('.DS_Store')) continue;
    const parts = e.name.split('/').filter(Boolean);
    if (!parts.length) continue;
    if (parts[0] === 'plugins' || parts[0] === 'plugin') parts.shift();
    if (!parts.length) continue;
    roots.add(parts[0]);
  }
  const imported = [];
  for (const root of roots) {
    const pdir = path.join(dir, root);
    fs.mkdirSync(pdir, { recursive: true });
    for (const e of entries) {
      if (e.name.includes('__MACOSX') || e.name.includes('.DS_Store')) continue;
      const parts = e.name.split('/').filter(Boolean);
      if (parts[0] === 'plugins' || parts[0] === 'plugin') parts.shift();
      if (!parts.length || parts[0] !== root) continue;
      const rel = parts.slice(1).join(path.sep);
      if (!rel) continue; // 目录条目
      const fp = path.join(pdir, rel);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, e.data);
    }
    imported.push(root);
  }
  return { count: imported.length, plugins: imported };
}

module.exports = { pluginsDir, listPlugins, setEnabled, loadPlugin, loadAllEnabled, importZip, getPluginToolDefinitions, callPluginTool };
