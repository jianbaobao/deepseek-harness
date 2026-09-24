'use strict';
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { initStore, getDataDir } = require('./store');
const { registerIpc } = require('./ipc');
const plugins = require('./plugins');

let win = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

app.setName('DeepSeek Harness Desktop');

function createMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ label: app.getName(), submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit', label: '退出' }] }] : []),
    { label: '文件', submenu: [
      { label: '选择项目文件夹…', click: () => { if (win) win.webContents.send('menu:open-project'); } },
      { label: '新建会话', click: () => { if (win) win.webContents.send('menu:new-session'); } },
      { type: 'separator' },
      isMac ? { role: 'close', label: '关闭窗口' } : { role: 'quit', label: '退出' }
    ] },
    { label: '编辑', submenu: [{ role: 'undo', label: '撤销' }, { role: 'redo', label: '重做' }, { type: 'separator' }, { role: 'cut', label: '剪切' }, { role: 'copy', label: '复制' }, { role: 'paste', label: '粘贴' }, { role: 'selectAll', label: '全选' }] },
    { label: '视图', submenu: [{ role: 'reload', label: '重新加载' }, { role: 'toggleDevTools', label: '开发者工具' }, { type: 'separator' }, { role: 'resetZoom', label: '重置缩放' }, { role: 'zoomIn', label: '放大' }, { role: 'zoomOut', label: '缩小' }, { type: 'separator' }, { role: 'togglefullscreen', label: '全屏' }] },
    { label: '帮助', submenu: [
      { label: 'DeepSeek 开发者平台', click: () => require('electron').shell.openExternal('https://platform.deepseek.com') },
      { label: '项目主页', click: () => require('electron').shell.openExternal('https://github.com/jianbaobao/deepseek-harness-desktop') },
      { label: '关于', click: () => { if (win) win.webContents.send('menu:about'); } }
    ] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    backgroundColor: '#101116',
    autoHideMenuBar: true,
    title: 'DeepSeek Harness Desktop',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });
  global.__mainWindow = win;

  win.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; });

  // 界面验证模式：启动后截图保存并退出（用于自动化检查 UI）
  if (process.env.DSH_VERIFY_UI) {
    const errors = [];
    win.webContents.on('console-message', (event, level, message) => {
      const m = (message !== undefined ? message : (event && event.message)) || '';
      const line = (event && typeof event === 'object' && event.lineNumber) || '';
      const src = (event && typeof event === 'object' && event.sourceId) || '';
      const lv = level !== undefined ? level : (event && event.level);
      if (lv >= 2) errors.push(m + ' @' + line + ' [' + src + ']');
    });
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const fs = require('fs');
          const path = require('path');
          const out = path.resolve(process.env.DSH_VERIFY_UI || 'verify-ui.png');
          const img = await win.webContents.capturePage();
          fs.writeFileSync(out, img.toPNG());
          const diag = await win.webContents.executeJavaScript(`
            (() => {
              const nav = [...document.querySelectorAll('.nav-item')].map(b => b.dataset.view + (b.classList.contains('active') ? '*' : ''));
              return JSON.stringify({
                nav,
                mainLen: document.getElementById('main').innerText.length,
                mainSample: document.getElementById('main').innerText.slice(0, 120),
                hasSidebar: !!document.getElementById('sidebar'),
                title: document.title
              });
            })()
          `);
          console.log('VERIFY_DIAG ' + diag);
          console.log('VERIFY_ERRORS ' + JSON.stringify(errors.slice(0, 10)));
          // 依次点击各导航视图，检查渲染
          let viewsDiag = 'SCRIPT_FAIL';
          try {
            viewsDiag = await win.webContents.executeJavaScript(`
              (async () => {
                try {
                  const out = {};
                  for (const v of ['chat', 'skills', 'mcp', 'plugins', 'settings', 'projects']) {
                    const btn = document.querySelector('.nav-item[data-view="' + v + '"]');
                    if (btn) btn.click();
                    await new Promise(r => setTimeout(r, 600));
                    const main = document.getElementById('main');
                    const txt = main ? main.innerText : '';
                    out[v] = { len: txt.length, head: txt.replace(/\\n/g, ' ').slice(0, 60) };
                  }
                  return JSON.stringify(out);
                } catch (e) {
                  return 'INNER_ERR: ' + e.message;
                }
              })()
            `);
          } catch (e) {
            viewsDiag = 'SCRIPT_ERR: ' + e.message;
          }
          console.log('VERIFY_VIEWS ' + viewsDiag);
          console.log('VERIFY_ERRORS2 ' + JSON.stringify(errors.slice(0, 10)));
          console.log('VERIFY_UI_OK ' + out);
        } catch (e) {
          console.error('VERIFY_UI_ERR ' + e.message);
        }
        app.exit(0);
      }, 5000);
    });
  }
}

app.whenReady().then(() => {
  initStore(app.getPath('userData'));
  registerIpc();
  createMenu();
  plugins.loadAllEnabled();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
