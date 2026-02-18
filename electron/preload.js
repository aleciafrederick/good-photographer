const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectPhotos: () => ipcRenderer.invoke('select-photos'),
  getExportDir: () => ipcRenderer.invoke('get-export-dir'),
  openExportFolder: (dir) => ipcRenderer.invoke('open-export-folder', dir),
  runProcessor: (payload) => ipcRenderer.invoke('run-processor', payload),
  onProcessorProgress: (fn) => {
    ipcRenderer.on('processor-progress', (_, data) => fn(data));
  },
});
