// The only bridge between the game page and the desktop shell: fullscreen and quit.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('kayalDesktop', {
  quit: () => ipcRenderer.send('kayal:quit'),
  toggleFullscreen: () => ipcRenderer.send('kayal:fullscreen'),
  isFullscreen: () => ipcRenderer.invoke('kayal:isFullscreen'),
  onFullscreen: (fn) => ipcRenderer.on('kayal:fullscreenChanged', (_e, on) => fn(on)),
});
