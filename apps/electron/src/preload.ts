import { contextBridge, ipcRenderer, webUtils } from 'electron';

export interface ProgressPayload {
  progress: number;
  currentFile: string;
  filesProcessed: number;
  totalFiles: number;
}

contextBridge.exposeInMainWorld('electronAPI', {
  isNative: true,

  openFile: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openFile'),

  openFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openFolder'),

  getPathForFile: (file: File): string => {
    try {
      return webUtils.getPathForFile(file) || (file as any).path || '';
    } catch {
      return (file as any).path || '';
    }
  },

  getStats: () =>
    ipcRenderer.invoke('app:getStats'),

  listAnalyses: (limit = 50, offset = 0) =>
    ipcRenderer.invoke('app:listAnalyses', limit, offset),

  getAnalysis: (id: string) =>
    ipcRenderer.invoke('app:getAnalysis', id),

  deleteAnalysis: (id: string) =>
    ipcRenderer.invoke('app:deleteAnalysis', id),

  clearAnalyses: () =>
    ipcRenderer.invoke('app:clearAnalyses'),

  exportJson: (id: string): Promise<{ saved: boolean; filePath?: string }> =>
    ipcRenderer.invoke('app:exportJson', id),

  analyze: (payload: { inputPath: string; inputType: 'file' | 'folder' | 'zip' }) =>
    ipcRenderer.invoke('app:analyze', payload),

  onProgress: (callback: (data: ProgressPayload) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: ProgressPayload) => callback(data);
    ipcRenderer.on('analysis:progress', listener);
    return () => {
      ipcRenderer.removeListener('analysis:progress', listener);
    };
  },

  getAppInfo: (): Promise<{ version: string; dataDir: string; platform: string }> =>
    ipcRenderer.invoke('app:getInfo'),

  openDataFolder: (): Promise<void> =>
    ipcRenderer.invoke('app:openDataFolder'),

  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('shell:openExternal', url),
});

export {};
