'use strict';
const { ipcMain, dialog, shell, app } = require('electron');
const path = require('path');
const fs = require('fs');
const settings = require('./settings');
const projects = require('./projects');
const sessions = require('./sessions');
const skills = require('./skills');
const mcp = require('./mcp');
const plugins = require('./plugins');
const agent = require('./agent');
const store = require('./store');

function getWin() {
  return global.__mainWindow;
}

function send(evt) {
  const w = getWin();
  if (w && !w.isDestroyed()) w.webContents.send('agent:event', evt);
}

function registerIpc() {
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    name: app.getName(),
    dataDir: store.getDataDir(),
    platform: process.platform
  }));

  ipcMain.handle('settings:get', () => settings.getSettings());
  ipcMain.handle('settings:set', (_e, patch) => settings.setSettings(patch));

  ipcMain.handle('projects:list', () => projects.list());
  ipcMain.handle('projects:add', (_e, dir) => projects.add(dir));
  ipcMain.handle('projects:remove', (_e, id) => projects.remove(id));
  ipcMain.handle('projects:rename', (_e, id, name) => projects.rename(id, name));
  ipcMain.handle('projects:touch', (_e, id) => projects.touch(id));

  ipcMain.handle('sessions:list', (_e, projectId) => sessions.list(projectId));
  ipcMain.handle('sessions:create', (_e, projectId) => sessions.create(projectId));
  ipcMain.handle('sessions:load', (_e, id) => sessions.load(id));
  ipcMain.handle('sessions:remove', (_e, id) => sessions.remove(id));
  ipcMain.handle('sessions:rename', (_e, id, title) => sessions.rename(id, title));

  ipcMain.handle('skills:list', () => skills.listSkills());
  ipcMain.handle('skills:setEnabled', (_e, id, enabled) => skills.setEnabled(id, enabled));
  ipcMain.handle('skills:content', (_e, id) => skills.getSkillContent(id));
  ipcMain.handle('skills:dir', () => skills.skillsDir());
  ipcMain.handle('skills:importZip', async (_e, zipPath) => {
    const p = zipPath || (await pickZip('选择技能压缩包')).filePaths[0];
    if (!p) return { cancelled: true };
    return { cancelled: false, result: skills.importZip(p) };
  });

  ipcMain.handle('mcp:list', () => mcp.listServers());
  ipcMain.handle('mcp:add', (_e, server) => mcp.add(server));
  ipcMain.handle('mcp:remove', (_e, id) => mcp.remove(id));
  ipcMain.handle('mcp:setEnabled', (_e, id, enabled) => mcp.setEnabled(id, enabled));
  ipcMain.handle('mcp:test', async (_e, server) => {
    try {
      const r = await mcp.testServer(server);
      return { ok: true, tools: r.tools };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
  ipcMain.handle('mcp:start', async (_e, id) => {
    const srv = mcp.listServers().find((s) => s.id === id);
    if (!srv) return { ok: false, error: '服务器不存在' };
    try {
      const tools = await mcp.startServer(srv);
      return { ok: true, tools };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
  ipcMain.handle('mcp:stop', (_e, id) => { mcp.stopServer(id); return { ok: true }; });

  ipcMain.handle('plugins:list', () => plugins.listPlugins());
  ipcMain.handle('plugins:setEnabled', (_e, id, enabled) => plugins.setEnabled(id, enabled));
  ipcMain.handle('plugins:installZip', async (_e, zipPath) => {
    const p = zipPath || (await pickZip('选择插件压缩包')).filePaths[0];
    if (!p) return { cancelled: true };
    return { cancelled: false, result: plugins.importZip(p) };
  });
  ipcMain.handle('plugins:dir', () => plugins.pluginsDir());

  ipcMain.handle('agent:start', (_e, payload) => {
    const project = projects.get(payload.projectId);
    if (!project) return { ok: false, error: '项目不存在' };
    let session = payload.sessionId ? sessions.load(payload.sessionId) : null;
    if (!session) {
      session = sessions.create(payload.projectId);
    }
    const text = String(payload.text || '').trim();
    if (!text) return { ok: false, error: '消息不能为空' };
    agent.runAgent(project, session, text, send).catch(() => { /* 错误已通过事件发送 */ });
    return { ok: true, sessionId: session.id };
  });
  ipcMain.handle('agent:stop', (_e, runId) => agent.stop(runId));
  ipcMain.handle('agent:approve', (_e, runId, callId, decision) => agent.approve(runId, callId, decision));

  ipcMain.handle('dialog:openDirectory', async () => dialog.showOpenDialog(getWin(), { properties: ['openDirectory', 'createDirectory'], title: '选择项目文件夹' }));
  ipcMain.handle('shell:openPath', (_e, p) => shell.openPath(p));
  ipcMain.handle('shell:openExternal', (_e, url) => shell.openExternal(url));
}

function pickZip(title) {
  return dialog.showOpenDialog(getWin(), { properties: ['openFile'], title, filters: [{ name: '压缩包', extensions: ['zip'] }] });
}

module.exports = { registerIpc, send };
