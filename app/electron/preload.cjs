// Bridge between the Electron main process and the (sandboxed) renderer.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hasiDesktop', {
  // Called by the renderer to receive OS-opened files (.dxf / .hasicad.json).
  onOpenFile(callback) {
    const listener = (_ev, payload) => callback(payload);
    ipcRenderer.on('hasi:open-file', listener);
    return () => ipcRenderer.removeListener('hasi:open-file', listener);
  },
  getVersion() {
    return ipcRenderer.invoke('hasi:version');
  },
});
