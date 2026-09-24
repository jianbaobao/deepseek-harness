import { h, toast, modal, confirmDialog } from '../lib/ui.js';
import { icon } from '../lib/icons.js';

export default {
  id: 'mcp',
  title: 'MCP',
  async mount(root, ctx) {
    let servers = [];
    let disposed = false;
    const api = ctx.api;

    const refresh = async () => {
      if (disposed) return;
      servers = await api.invoke('mcp:list');
      render();
    };

    const showAddForm = () => {
      const fName = h('input', { class: 'input', placeholder: '例如：文件系统 MCP' });
      const fCmd = h('input', { class: 'input', placeholder: '例如：npx -y @modelcontextprotocol/server-filesystem' });
      const fCwd = h('input', { class: 'input', placeholder: '可选：工作目录' });
      const fEnv = h('textarea', { class: 'textarea', placeholder: '可选：环境变量，每行一个 KEY=VALUE', style: 'min-height:60px' });
      const save = h('button', { class: 'btn primary', text: '保存' });
      const cancel = h('button', { class: 'btn', text: '取消' });
      const body = h('div', {}, [
        field('名称', fName),
        field('命令（含参数）', fCmd),
        field('工作目录', fCwd),
        field('环境变量', fEnv)
      ]);
      const mask = modal({ title: '添加 MCP 服务器', body, actions: [cancel, save], width: '560px' });
      save.addEventListener('click', async () => {
        const name = fName.value.trim();
        const cmd = fCmd.value.trim();
        if (!name || !cmd) { toast('名称和命令不能为空', 'err'); return; }
        const env = {};
        for (const line of fEnv.value.split('\n')) {
          const i = line.indexOf('=');
          if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
        }
        await api.invoke('mcp:add', { name, command: cmd, cwd: fCwd.value.trim(), env });
        mask.remove();
        toast('已添加：' + name, 'ok');
        refresh();
      });
      cancel.addEventListener('click', () => mask.remove());
    };

    function field(label, input) {
      return h('div', { class: 'field' }, [h('label', { text: label }), input]);
    }

    const testServer = async (s) => {
      const btn = document.querySelector('[data-test="' + s.id + '"]');
      if (btn) { btn.disabled = true; btn.textContent = '测试中…'; }
      const res = await api.invoke('mcp:test', s);
      if (btn) { btn.disabled = false; btn.textContent = '测试连接'; }
      if (res.ok) {
        toast('连接成功，发现 ' + res.tools.length + ' 个工具', 'ok');
        refresh();
      } else {
        toast('连接失败：' + (res.error || '未知错误'), 'err');
      }
    };

    const render = () => {
      root.innerHTML = '';
      root.appendChild(h('div', { class: 'view-header' }, [
        h('div', { class: 'view-title', text: 'MCP 设置' }),
        h('div', { class: 'view-sub', text: 'Model Context Protocol —— 连接外部数据源与工具服务器' }),
        h('div', { class: 'view-actions' }, [
          h('button', { class: 'btn primary', onclick: showAddForm }, [icon('plus', 'nav-ico'), h('span', { text: '添加服务器' })]),
          h('button', { class: 'btn', onclick: refresh }, [h('span', { text: '刷新' })])
        ])
      ]));
      if (!servers.length) {
        root.appendChild(h('div', { class: 'empty-tip', text: '还没有 MCP 服务器。点击「添加服务器」配置一个 stdio 类型的 MCP（如文件系统、数据库、浏览器等）。' }));
        return;
      }
      const grid = h('div', { class: 'card-grid' });
      for (const s of servers) {
        const card = h('div', { class: 'card' }, [
          h('div', { class: 'card-title' }, [
            h('span', { class: 'dot ' + (s.status === 'running' ? 'ok' : 'err') }),
            h('span', { text: s.name }),
            h('span', { style: 'margin-left:auto;display:flex;align-items:center;gap:8px' }, [
              s.status === 'running' ? h('span', { class: 'badge ok', text: '运行中' }) : h('span', { class: 'badge', text: '已停止' }),
              h('label', { class: 'switch' }, [
                h('input', { type: 'checkbox', checked: s.enabled ? 'checked' : null, onchange: (e) => {
                  api.invoke('mcp:setEnabled', s.id, e.target.checked).then(refresh);
                } }),
                h('span', { class: 'track' })
              ])
            ])
          ]),
          h('div', { class: 'project-path', text: s.command }),
          h('div', { class: 'card-meta' }, [
            h('span', { class: 'badge accent', text: s.tools.length + ' 个工具' }),
            ...(s.tools || []).slice(0, 5).map((t) => h('span', { class: 'badge', text: t.name })),
            s.tools && s.tools.length > 5 ? h('span', { class: 'badge', text: '+' + (s.tools.length - 5) }) : null
          ]),
          h('div', { class: 'card-actions' }, [
            h('button', { class: 'btn small', dataset: { test: s.id }, onclick: () => testServer(s) }, [icon('test', 'nav-ico'), h('span', { text: '测试连接' })]),
            s.status === 'running'
              ? h('button', { class: 'btn small', onclick: async () => { await api.invoke('mcp:stop', s.id); toast('已停止：' + s.name, 'ok'); refresh(); } }, [h('span', { text: '停止' })])
              : h('button', { class: 'btn small primary', onclick: async () => {
                  const r = await api.invoke('mcp:start', s.id);
                  if (r.ok) { toast('已启动：' + s.name, 'ok'); } else { toast('启动失败：' + r.error, 'err'); }
                  refresh();
                } }, [icon('play', 'nav-ico'), h('span', { text: '启动' })]),
            h('button', { class: 'btn small danger', onclick: () => {
              confirmDialog('删除服务器', '确定删除 MCP 服务器「' + s.name + '」？', async () => {
                await api.invoke('mcp:remove', s.id);
                toast('已删除', 'ok');
                refresh();
              });
            } }, [icon('trash', 'nav-ico'), h('span', { text: '删除' })])
          ])
        ]);
        grid.appendChild(card);
      }
      root.appendChild(grid);
    };

    await refresh();
    return () => { disposed = true; };
  }
};
