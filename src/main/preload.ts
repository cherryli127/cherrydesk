import { contextBridge, ipcRenderer } from 'electron';
import { ScanResult, FileNode } from '../common/types';

interface ExecutionResult {
    success: boolean;
    processed: number;
    errors: string[];
}

contextBridge.exposeInMainWorld('api', {
  /** 选择多个目录 */
  selectFolders: (): Promise<string[]> => ipcRenderer.invoke('select-folders'),
  /** 统计文件数量 */
  countFiles: (folders: string[]) =>
    ipcRenderer.invoke('count-files', folders),
  /** 扫描目录结构 */
  scanFolders: (folders: string[]): Promise<ScanResult[]> => 
    ipcRenderer.invoke('scan-folders', folders),
  /** 预览组织结果 */
  previewOrganization: (strategyId: string, root: FileNode): Promise<FileNode> =>
    ipcRenderer.invoke('preview-organization', strategyId, root),
  /** 获取策略列表 */
  getStrategies: () => ipcRenderer.invoke('get-strategies'),
  /** 执行组织 */
  executeOrganization: (rootPath: string, workingTreeRoot: FileNode): Promise<ExecutionResult> =>
    ipcRenderer.invoke('execute-organization', rootPath, workingTreeRoot),
  /** 撤销 */
  undoLastBatch: (): Promise<ExecutionResult> => ipcRenderer.invoke('undo-last-batch'),
  /** 原来的 ping */
  ping: (message: string) => ipcRenderer.invoke('ping', message)
});
