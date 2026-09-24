import { h, toast, modal, confirmDialog } from '../lib/ui.js';
import { icon } from '../lib/icons.js';

export default {
  id: 'skills',
  title: '技能',
  async mount(root, ctx) {
    let skills = [];
    let disposed = false;
    const api = ctx.api;

    const refresh = async () => {
      if (disposed) return;
      skills = await api.invoke('skills:list');
      render();
    };

    const importZip = async () => {
      const res = await api.invoke('skills:importZip');
      if (!res || res.cancelled) return;
      toast('成功导入 ' + res.result.count + ' 个技能：' + res.result.files.join(', '), 'ok');
      refresh();
    };

    const render = () => {
      root.innerHTML = '';
      root.appendChild(h('div', { class: 'view-header' }, [
        h('div', { class: 'view-title', text: '技能' }),
        h('div', { class: 'view-sub', text: '给 AI 预置的专业能力，可打包为 zip 导入' }),
        h('div', { class: 'view-actions' }, [
          h('button', { class: 'btn primary', onclick: importZip }, [icon('download', 'nav-ico'), h('span', { text: '导入技能包 (zip)' })]),
          h('button', { class: 'btn', onclick: async () => { const dir = await api.invoke('skills:dir'); api.invoke('shell:openPath', dir); } }, [icon('folder', 'nav-ico'), h('span', { text: '打开技能目录' })]),
          h('button', { class: 'btn', onclick: refresh }, [h('span', { text: '刷新' })])
        ])
      ]));
      if (!skills.length) {
        root.appendChild(h('div', { class: 'empty-tip', text: '技能目录为空。可点击「导入技能包 (zip)」安装，或直接打开技能目录放入 .md 技能文件。' }));
        return;
      }
      const grid = h('div', { class: 'card-grid' });
      for (const s of skills) {
        const card = h('div', { class: 'card' }, [
          h('div', { class: 'card-title' }, [
            icon('skills', 'nav-ico'),
            h('span', { text: s.name }),
            h('span', { style: 'margin-left:auto;display:flex;align-items:center;gap:8px' }, [
              s.enabled ? h('span', { class: 'badge ok', text: '已启用' }) : h('span', { class: 'badge', text: '已停用' }),
              h('label', { class: 'switch' }, [
                h('input', { type: 'checkbox', checked: s.enabled ? 'checked' : null, onchange: (e) => {
                  api.invoke('skills:setEnabled', s.id, e.target.checked).then(() => { toast(s.name + (e.target.checked ? ' 已启用' : ' 已停用'), 'ok'); refresh(); });
                } }),
                h('span', { class: 'track' })
              ])
            ])
          ]),
          h('div', { class: 'card-desc', text: s.description || '（无描述）' }),
          h('div', { class: 'card-meta' }, [
            h('span', { class: 'badge', text: '版本 ' + (s.version || '—') }),
            h('span', { class: 'badge', text: s.language || 'zh-CN' }),
            h('span', { class: 'badge', text: s.file })
          ]),
          h('div', { class: 'card-actions' }, [
            h('button', { class: 'btn small', onclick: async () => {
              const content = await api.invoke('skills:content', s.id);
              const pre = h('pre', { text: content });
              modal({ title: '技能内容：' + s.name, body: pre, width: '720px' });
            } }, [icon('doc', 'nav-ico'), h('span', { text: '查看内容' })])
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
