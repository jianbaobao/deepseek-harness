'use strict';
const fs = require('fs');
const path = require('path');
const { resolve } = require('./store');
const { getSettings, setSettings } = require('./settings');
const { zipRead } = require('../../scripts/zip-utils.cjs');

function skillsDir() {
  const s = getSettings();
  if (s.paths && s.paths.skillsDir) return path.resolve(s.paths.skillsDir);
  return resolve('skills');
}

function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) {
      const k = line.slice(0, i).trim();
      let v = line.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      meta[k] = v;
    }
  }
  return { meta, body: m[2] };
}

function scanDir(dir, base) {
  const out = [];
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { return out; }
  for (const n of names) {
    const fp = path.join(dir, n);
    let st = null;
    try { st = fs.statSync(fp); } catch (e) { continue; }
    if (st.isDirectory()) {
      out.push(...scanDir(fp, base));
    } else if (/\.(md|yaml|yml)$/i.test(n)) {
      try {
        const text = fs.readFileSync(fp, 'utf8');
        const { meta, body } = parseFrontmatter(text);
        const rel = path.relative(base, fp);
        const id = rel.replace(/\\/g, '/').replace(/\.(md|yaml|yml)$/i, '');
        out.push({
          id,
          file: rel,
          name: meta.name || id.split('/').pop(),
          description: meta.description || '',
          version: meta.version || '',
          language: meta.language || '',
          enabled: true,
          body: body.slice(0, 6000)
        });
      } catch (e) { /* 跳过坏文件 */ }
    }
  }
  return out;
}

function listSkills() {
  const dir = skillsDir();
  const enabledMap = (getSettings().skillsEnabled || {});
  return scanDir(dir, dir).map((s) => ({ ...s, enabled: enabledMap[s.id] !== false }));
}

function setEnabled(id, enabled) {
  const s = getSettings();
  const m = s.skillsEnabled || {};
  m[id] = enabled;
  setSettings({ skillsEnabled: m });
}

function getSkillContent(id) {
  const dir = skillsDir();
  const candidates = [
    path.join(dir, id.replace(/\//g, path.sep) + '.md'),
    path.join(dir, id.replace(/\//g, path.sep) + '.yaml'),
    path.join(dir, id.replace(/\//g, path.sep) + '.yml')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8');
  }
  return '';
}

function importZip(zipPath) {
  const buf = fs.readFileSync(zipPath);
  const entries = zipRead(buf);
  const dir = skillsDir();
  const imported = [];
  const textFiles = entries.filter((e) => /\.(md|yaml|yml)$/i.test(e.name) && !/__MACOSX|\.DS_Store/i.test(e.name));
  if (!textFiles.length) throw new Error('压缩包内没有找到技能文件（.md/.yaml）');
  // 找公共根目录
  const parts = textFiles.map((e) => e.name.split('/'));
  let commonDepth = 1;
  for (let d = 1; d < Math.min(...parts.map((p) => p.length)); d++) {
    const seg = parts[0][d];
    if (parts.every((p) => p[d] === seg)) commonDepth = d + 1;
    else break;
  }
  for (const e of textFiles) {
    const seg = e.name.split('/').slice(commonDepth).filter(Boolean);
    const rel = seg.join(path.sep) || path.basename(e.name);
    const fp = path.join(dir, rel);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    // 若已存在，自动改名
    let final = fp;
    let i = 1;
    while (fs.existsSync(final)) {
      const ext = path.extname(fp);
      final = fp.slice(0, fp.length - ext.length) + '-' + i++ + ext;
    }
    fs.writeFileSync(final, e.data);
    imported.push(path.relative(dir, final).replace(/\\/g, '/'));
  }
  return { count: imported.length, files: imported };
}

function buildSkillContext() {
  const enabled = listSkills().filter((s) => s.enabled);
  if (!enabled.length) return '';
  const parts = [];
  for (const s of enabled) {
    parts.push('## 技能：' + s.name + (s.description ? '\n简介：' + s.description : '') + '\n\n' + s.body);
  }
  return '以下是你当前可用的技能说明，当任务与技能相关时请遵循其指引：\n\n' + parts.join('\n\n---\n\n');
}

module.exports = { skillsDir, listSkills, setEnabled, getSkillContent, importZip, buildSkillContext, parseFrontmatter };
