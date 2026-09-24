'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { readJson, writeJson } = require('./store');

function list() {
  const projs = readJson('projects.json', []);
  return projs.slice().sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));
}

function saveAll(projs) {
  writeJson('projects.json', projs);
}

function idOf(p) {
  return crypto.createHash('sha1').update(path.resolve(p)).digest('hex').slice(0, 12);
}

function add(dir) {
  const real = path.resolve(dir);
  if (!fs.existsSync(real) || !fs.statSync(real).isDirectory()) {
    throw new Error('目录不存在：' + real);
  }
  const projs = list();
  const id = idOf(real);
  const found = projs.find((p) => p.id === id);
  const now = Date.now();
  if (found) {
    found.lastOpenedAt = now;
    saveAll(projs);
    return found;
  }
  const entry = {
    id,
    name: path.basename(real) || real,
    path: real,
    createdAt: now,
    lastOpenedAt: now
  };
  projs.push(entry);
  saveAll(projs);
  return entry;
}

function get(id) {
  return list().find((p) => p.id === id) || null;
}

function remove(id) {
  saveAll(list().filter((p) => p.id !== id));
}

function rename(id, name) {
  const projs = list();
  const p = projs.find((x) => x.id === id);
  if (p) {
    p.name = name;
    saveAll(projs);
  }
  return p;
}

function touch(id) {
  const projs = list();
  const p = projs.find((x) => x.id === id);
  if (p) {
    p.lastOpenedAt = Date.now();
    saveAll(projs);
  }
  return p;
}

module.exports = { list, add, get, remove, rename, touch };
