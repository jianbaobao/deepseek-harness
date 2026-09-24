import { h, toast, confirmDialog } from '../lib/ui.js';
import { icon } from '../lib/icons.js';

export default {
  id: 'plugins',
  title: '插件',
  async mount(root, ctx) {
    let plugins = [];
    let disposed = false;
    const api = ctx.api;

    const refresh = async () => {
      if (disposed) return;
      plugins = await api.invoke('plugins:list');
      render();
    };

    const installZip = async () => {
      const res = await api.invoke('plugins:installZip');
      if (!res || res.cancelled) return;
      toast('成功安装 ' + res.result.count + ' 个插件：' + res.result.plugins.join(', '), 'ok');
      refresh();
    };

    const render = () => {
      root.innerHTML = '';
      root.appendChild(h('div', { class: 'view-header' }, [
        h('div', { class: 'view-title', text: '插件' }),
        h('div', { class: 'view-sub', text: '扩展 AI 的工具能力：插件可用 JS 编写，打包为 zip 安装' }),
        h('div', { class: 'view-actions' }, [
          h('button', { class: 'btn primary', onclick: installZip }, [icon('download', 'nav-ico'), h('span', { text: '安装插件包 (zip)' })]),
          h('button', { class: 'btn', onclick: async () => { const dir = await api.invoke('plugins:dir'); api.invoke('shell:openPath', dir); } }, [icon('folder', 'nav-ico'), h('span', { text: '打开插件目录' })]),
          h('button', { class: 'btn', onclick: refresh }, [h('span', { text: '刷新' })])
        ])
      ]));
      if (!plugins.length) {
        root.appendChild(h('div', { class: 'empty-tip', text: '还没有插件。插件目录位于用户数据目录 plugins/ 下，每个插件是一个包含 plugin.json 的文件夹；也可以直接安装 zip 插件包。' }));
        return;
      }
      const grid = h('div', { class: 'card-grid' });
      for (const p of plugins) {
        const card = h('div', { class: 'card' }, [
          h('div', { class: 'card-title' }, [
            icon('plugins', 'nav-ico'),
            h('span', { text: p.name }),
            h('span', { style: 'margin-left:auto;display:flex;align-items:center;gap:8px' }, [
              p.enabled ? h('span', { class: 'badge ok', text: '已启用' }) : h('span', { class: 'badge', text: '已停用' }),
              h('label', { class: 'switch' }, [
                h('input', { type: 'checkbox', checked: p.enabled ? 'checked' : null, onchange: (e) => {
                  api.invoke('plugins:setEnabled', p.id, e.target.checked).then(() => { toast(p.name + (e.target.checked ? ' 已启用' : ' 已停用'), 'ok'); refresh(); });
                } }),
                h('span', { class: 'track' })
              ])
            ])
          ]),
          h('div', { class: 'card-desc', text: p.description || '（无描述）' }),
          h('div', { class: 'card-meta' }, [
            h('span', { class: 'badge', text: 'v' + p.version }),
            p.author ? h('span', { class: 'badge', text: p.author }) : null,
            p.tools && p.tools.length ? h('span', { class: 'badge accent', text: p.tools.length + ' 个工具' }) : null
          ]),
          h('div', { class: 'card-actions' }, [
            h('button', { class: 'btn small danger', onclick: () => {
              confirmDialog('移除插件', '确定移除插件「' + p.name + '」？', async () => {
                await api.invoke('plugins:setEnabled', p.id, false);
                toast('已停用（如需彻底删除请到插件目录手动删除）', 'ok');
                refresh();
              });
            } }, [icon('trash', 'nav-ico'), h('span', { text: '移除' })])
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
