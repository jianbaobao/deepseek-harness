import { h, toast, modal } from './lib/ui.js';
import { icons, icon } from './lib/icons.js';

const views = {
  projects: () => import('./views/projects.js'),
  chat: () => import('./views/chat.js'),
  skills: () => import('./views/skills.js'),
  mcp: () => import('./views/mcp.js'),
  plugins: () => import('./views/plugins.js'),
  settings: () => import('./views/settings.js')
};

const state = {
  currentView: 'projects',
  currentProjectId: null,
  currentProject: null,
  agentHandler: null
};

let currentUnmount = null;

const api = window.dsh;

function refreshStatus() {
  api.invoke('settings:get').then((s) => {
    const el = document.getElementById('model-status');
    if (!el) return;
    const key = s.provider.apiKey || '';
    el.textContent = key ? (s.provider.model || 'deepseek-chat') + ' ✓' : '未配置 API Key，请到设置填写';
    if (!key) el.style.color = '#fbbf24';
    else el.style.color = '#34d399';
    document.documentElement.dataset.theme = s.appearance && s.appearance.theme === 'light' ? 'light' : 'dark';
  }).catch(() => {});
}

async function navigate(view) {
  if (!views[view]) return;
  if (currentUnmount) {
    try { currentUnmount(); } catch (e) { /* 忽略 */ }
    currentUnmount = null;
  }
  state.currentView = view;
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  const main = document.getElementById('main');
  main.innerHTML = '';
  try {
    const mod = await views[view]();
    currentUnmount = await mod.default.mount(main, {
      api,
      state,
      navigate,
      openProject,
      refreshStatus
    });
  } catch (e) {
    console.error(e);
    main.innerHTML = '';
    main.appendChild(h('div', { class: 'empty-tip', text: '视图加载失败：' + e.message }));
  }
}

async function openProject(id) {
  const list = await api.invoke('projects:list');
  const p = list.find((x) => x.id === id);
  if (!p) { toast('项目不存在', 'err'); return; }
  state.currentProjectId = id;
  state.currentProject = p;
  await api.invoke('projects:touch', id);
  navigate('chat');
}

function initNav() {
  const nav = document.getElementById('nav');
  // 注入导航图标
  nav.querySelectorAll('.nav-item').forEach((b) => {
    const ico = b.querySelector('.nav-ico');
    if (ico) ico.innerHTML = icons[b.dataset.view] || icons.info;
    b.addEventListener('click', () => navigate(b.dataset.view));
  });
  document.getElementById('btn-data-dir').addEventListener('click', async () => {
    const info = await api.invoke('app:info');
    api.invoke('shell:openPath', info.dataDir);
  });
  document.getElementById('btn-about').addEventListener('click', showAbout);
}

async function showAbout() {
  const info = await api.invoke('app:info');
  const body = h('div', { style: 'line-height:1.9' }, [
    h('div', { text: 'DeepSeek Harness Desktop（桌面版） v' + info.version }),
    h('div', { class: 'hint', text: '基于 deepseek-ai/deepseek-harness 生态的中文 AI 编程助手桌面客户端' }),
    h('div', { class: 'hint', text: '数据目录：' + info.dataDir }),
    h('div', { style: 'margin-top:10px' }, [
      h('button', { class: 'btn small', onclick: () => api.invoke('shell:openExternal', 'https://github.com/jianbaobao/deepseek-harness-desktop') }, [icon('external', 'nav-ico'), h('span', { text: '项目主页' })]),
      h('button', { class: 'btn small', style: 'margin-left:8px', onclick: () => api.invoke('shell:openExternal', 'https://github.com/deepseek-ai/deepseek-harness') }, [icon('external', 'nav-ico'), h('span', { text: 'deepseek-harness 上游' })])
    ])
  ]);
  modal({ title: '关于', body, width: '480px' });
}

// Agent 事件总线
api.onAgentEvent((evt) => {
  if (state.agentHandler) state.agentHandler(evt);
});

// 菜单事件
api.onMenu((name) => {
  if (name === 'open-project') {
    navigate('projects');
  } else if (name === 'new-session') {
    if (state.currentProjectId) navigate('chat');
    else navigate('projects');
  } else if (name === 'about') {
    showAbout();
  }
});

// 启动
initNav();
refreshStatus();
navigate('projects');
