const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  checkStatus: () => ipcRenderer.invoke('check-status'),
  startSetup: () => ipcRenderer.invoke('start-setup'),
  search: (query) => ipcRenderer.invoke('search', query),
  getImagePath: (id) => ipcRenderer.invoke('get-image-path', id),
  copyImage: (imagePath) => ipcRenderer.invoke('copy-image', imagePath),

  onSetupProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('setup-progress', listener);
    return () => ipcRenderer.removeListener('setup-progress', listener);
  },
});
