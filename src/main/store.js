'use strict';
// 简单的 JSON 文件存储（原子写入）
const fs = require('fs');
const path = require('path');

let dataDir = null;

function initStore(dir) {
  dataDir = dir;
  for (const d of ['sessions', 'skills', 'plugins']) {
    const p = path.join(dataDir, d);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  }
  // 首次运行：把内置示例技能复制到技能目录
  try {
    const skillsDir = path.join(dataDir, 'skills');
    const existing = fs.readdirSync(skillsDir).filter((n) => /.(md|yaml|yml)$/i.test(n));
    if (existing.length === 0) {
      const bundle = path.join(__dirname, '..', '..', 'resources', 'skills-bundle');
      if (fs.existsSync(bundle)) {
        for (const n of fs.readdirSync(bundle)) {
          if (/.(md|yaml|yml)$/i.test(n)) {
            fs.copyFileSync(path.join(bundle, n), path.join(skillsDir, n));
          }
        }
      }
    }
  } catch (e) { /* 打包后 resources 位于 asar，读取失败时忽略 */ }
}

function getDataDir() {
  return dataDir;
}

function readJson(rel, fallback) {
  const p = path.join(dataDir, rel);
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJson(rel, obj) {
  const p = path.join(dataDir, rel);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, p);
}

function exists(rel) {
  return fs.existsSync(path.join(dataDir, rel));
}

function resolve(rel) {
  return path.join(dataDir, rel);
}

module.exports = { initStore, getDataDir, readJson, writeJson, exists, resolve };
