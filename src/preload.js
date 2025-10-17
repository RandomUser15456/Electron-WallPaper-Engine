
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onChangeTheme: (callback) => ipcRenderer.on('change-theme', (event, theme) => callback(theme)),
  onUpdateSettings: (callback) => ipcRenderer.on('update-settings', (event, settings) => callback(settings)),
  onToggleAnimation: (callback) => ipcRenderer.on('toggle-animation', () => callback())
});;

