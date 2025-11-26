import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { scanDirectory } from './scanner';
import { getStrategy, strategies } from './strategies';
import { FileNode } from '../common/types';
import { calculateDiff } from './utils/diff';
import { BatchExecutor } from './executor';

let mainWindow: BrowserWindow | null = null;
const executor = new BatchExecutor();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/** 选择多个目录 */
ipcMain.handle('select-folders', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'multiSelections']
  });
  if (result.canceled) return [];
  return result.filePaths;
});

/** 递归统计某个目录下的文件数量 */
function countFilesInDir(dir: string): number {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += countFilesInDir(full);
    } else if (entry.isFile()) {
      count += 1;
    }
  }
  return count;
}

/** 统计多个目录的文件数量（逐个 + 总数） */
ipcMain.handle('count-files', async (_event, folders: string[]) => {
  const perFolder = folders.map(folder => ({
    folder,
    count: countFilesInDir(folder)
  }));
  const total = perFolder.reduce((s, f) => s + f.count, 0);
  return { perFolder, total };
});

/** 扫描目录并返回完整树结构 */
ipcMain.handle('scan-folders', async (_event, folders: string[]) => {
  const results = await Promise.all(
    folders.map(folder => scanDirectory(folder))
  );
  return results;
});

/** 预览组织策略 */
ipcMain.handle('preview-organization', async (_event, strategyId: string, root: FileNode) => {
  const strategy = getStrategy(strategyId);
  if (!strategy) throw new Error(`Strategy ${strategyId} not found`);
  
  return await strategy.apply(root);
});

/** 获取可用策略列表 */
ipcMain.handle('get-strategies', async () => {
    return strategies.map(s => ({ id: s.id, name: s.name, description: s.description }));
});

/** 执行文件移动 */
ipcMain.handle('execute-organization', async (_event, rootPath: string, workingTreeRoot: FileNode) => {
    const ops = calculateDiff(rootPath, workingTreeRoot);
    if (ops.length === 0) return { success: true, processed: 0, errors: [] };
    
    return await executor.execute(ops);
});

/** 撤销上一次操作 */
ipcMain.handle('undo-last-batch', async () => {
    return await executor.undoLastBatch();
});

/** 原来的 ping 保留（可删） */
ipcMain.handle('ping', async (_event, message: string) => {
  console.log('Renderer says:', message);
  return `pong: ${message}`;
});
