import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  /** 选择多个目录 */
  selectFolders: (): Promise<string[]> => ipcRenderer.invoke('select-folders'),
  /** 统计文件数量 */
  countFiles: (folders: string[]) =>
    ipcRenderer.invoke('count-files', folders),
  /** 原来的 ping */
  ping: (message: string) => ipcRenderer.invoke('ping', message)
});