'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dsh', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  onAgentEvent: (cb) => {
    const listener = (_e, evt) => cb(evt);
    ipcRenderer.on('agent:event', listener);
    return () => ipcRenderer.removeListener('agent:event', listener);
  },
  onMenu: (cb) => {
    const listener = (_e, name) => cb(name);
    ipcRenderer.on('menu:open-project', () => cb('open-project'));
    ipcRenderer.on('menu:new-session', () => cb('new-session'));
    ipcRenderer.on('menu:about', () => cb('about'));
    return () => { ipcRenderer.removeAllListeners('menu:open-project'); ipcRenderer.removeAllListeners('menu:new-session'); ipcRenderer.removeAllListeners('menu:about'); };
  }
});
