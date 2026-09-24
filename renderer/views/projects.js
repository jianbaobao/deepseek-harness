import { h, toast, fmtTime, confirmDialog } from '../lib/ui.js';
import { icon } from '../lib/icons.js';

export default {
  id: 'projects',
  title: '项目',
  async mount(root, ctx) {
    let projects = [];
    let disposed = false;

    const refresh = async () => {
      if (disposed) return;
      projects = await ctx.api.invoke('projects:list');
      render();
    };

    const openFolder = async () => {
      const res = await ctx.api.invoke('dialog:openDirectory');
      if (!res || res.canceled || !res.filePaths || !res.filePaths.length) return;
      const dir = res.filePaths[0];
      const p = await ctx.api.invoke('projects:add', dir);
      toast('已添加项目：' + p.name, 'ok');
      refresh();
    };

    const render = async () => {
      root.innerHTML = '';
      root.appendChild(h('div', { class: 'view-header' }, [
        h('div', { class: 'view-title', text: '项目' }),
        h('div', { class: 'view-sub', text: '管理你的工作目录，在项目中与 AI 协作' }),
        h('div', { class: 'view-actions' }, [
          h('button', { class: 'btn primary', onclick: openFolder }, [icon('folder'), h('span', { text: '打开文件夹' })]),
          h('button', { class: 'btn', onclick: refresh }, [icon('x', 'nav-ico'), h('span', { text: '刷新' })])
        ])
      ]));
      if (!projects.length) {
        root.appendChild(h('div', { class: 'projects-empty' }, [
          h('div', { style: 'font-size:40px;opacity:.4', text: '📁' }),
          h('div', { style: 'margin-top:14px;font-size:14px', text: '还没有项目，打开一个文件夹开始吧' }),
          h('div', { style: 'margin-top:18px' }, [h('button', { class: 'btn primary', onclick: openFolder, text: '选择项目文件夹' })])
        ]));
        return;
      }
      const grid = h('div', { class: 'card-grid' });
      for (const p of projects) {
        const sessions = await ctx.api.invoke('sessions:list', p.id);
        const card = h('div', { class: 'card project-card' }, [
          h('div', { class: 'card-title' }, [
            icon('folder', 'nav-ico'),
            h('span', { text: p.name })
          ]),
          h('div', { class: 'project-path', text: p.path }),
          h('div', { class: 'card-meta' }, [
            h('span', { class: 'badge accent', text: sessions.length + ' 个会话' }),
            h('span', { class: 'badge', text: '最近打开 ' + fmtTime(p.lastOpenedAt) })
          ]),
          h('div', { class: 'card-actions' }, [
            h('button', { class: 'btn primary small', onclick: () => ctx.openProject(p.id) }, [icon('play', 'nav-ico'), h('span', { text: '进入会话' })]),
            h('button', { class: 'btn small', onclick: () => ctx.api.invoke('shell:openPath', p.path) }, [icon('external', 'nav-ico'), h('span', { text: '打开目录' })]),
            h('button', { class: 'btn small danger', onclick: () => {
              confirmDialog('移除项目', '仅从列表中移除「' + p.name + '」，不会删除磁盘文件。确定？', async () => {
                await ctx.api.invoke('projects:remove', p.id);
                toast('已移除', 'ok');
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
