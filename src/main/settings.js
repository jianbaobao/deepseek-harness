'use strict';
const { readJson, writeJson } = require('./store');

const DEFAULTS = {
  provider: {
    baseUrl: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    model: 'deepseek-chat',
    temperature: 0.7,
    maxTokens: 8192,
    systemPrompt: '你是 DeepSeek Harness 桌面版的智能编程助手，工作于用户的本地项目环境中。' +
      '你可以调用工具来执行命令、读写文件、搜索目录、访问网页等。' +
      '回答使用用户使用的语言（默认中文），尽量给出可直接落地的方案。'
  },
  appearance: {
    theme: 'dark',
    fontSize: 14,
    language: 'zh-CN'
  },
  agent: {
    maxToolRounds: 12,
    shellTimeoutMs: 60000,
    autoApprove: ['read_file', 'list_dir', 'grep', 'web_fetch', 'get_project_info'],
    askBeforeWrite: true
  },
  paths: {
    skillsDir: '',
    pluginsDir: ''
  },
  network: {
    proxy: ''
  }
};

function deepMerge(base, patch) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  if (patch && typeof patch === 'object') {
    for (const k of Object.keys(patch)) {
      const v = patch[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') {
        out[k] = deepMerge(base[k], v);
      } else {
        out[k] = v;
      }
    }
  }
  return out;
}

function getSettings() {
  const raw = readJson('settings.json', {});
  return deepMerge(DEFAULTS, raw);
}

function setSettings(patch) {
  const merged = deepMerge(getSettings(), patch || {});
  writeJson('settings.json', merged);
  return merged;
}

module.exports = { getSettings, setSettings, DEFAULTS, deepMerge };
