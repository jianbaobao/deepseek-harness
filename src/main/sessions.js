'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { resolve, exists } = require('./store');

function list(projectId) {
  const dir = resolve('sessions');
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch (e) {
    return [];
  }
  const out = [];
  for (const n of names) {
    if (!n.endsWith('.json')) continue;
    try {
      const s = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'));
      if (projectId && s.projectId !== projectId) continue;
      out.push({
        id: s.id,
        projectId: s.projectId,
        title: s.title || '未命名会话',
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: (s.messages || []).length,
        preview: previewOf(s)
      });
    } catch (e) {
      // 跳过损坏文件
    }
  }
  return out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function previewOf(s) {
  const msgs = s.messages || [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role === 'user' && typeof m.content === 'string' && m.content.trim()) {
      return m.content.slice(0, 60);
    }
  }
  return '';
}

function fileOf(id) {
  return resolve(path.join('sessions', id + '.json'));
}

function create(projectId) {
  const id = crypto.randomUUID().slice(0, 8);
  const now = Date.now();
  const s = {
    id,
    projectId,
    title: '新会话',
    createdAt: now,
    updatedAt: now,
    messages: []
  };
  save(s);
  return s;
}

function load(id) {
  const fp = fileOf(id);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    return null;
  }
}

function save(s) {
  s.updatedAt = Date.now();
  if (!s.title || s.title === '新会话') {
    const first = (s.messages || []).find((m) => m.role === 'user' && typeof m.content === 'string' && m.content.trim());
    if (first) s.title = first.content.slice(0, 40);
  }
  fs.writeFileSync(fileOf(s.id), JSON.stringify(s, null, 2), 'utf8');
}

function remove(id) {
  const fp = fileOf(id);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

function rename(id, title) {
  const s = load(id);
  if (s) {
    s.title = title;
    save(s);
    return s;
  }
  return null;
}

module.exports = { list, create, load, save, remove, rename, fileOf, exists };
