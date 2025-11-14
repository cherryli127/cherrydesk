import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;

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

/** 原来的 ping 保留（可删） */
ipcMain.handle('ping', async (_event, message: string) => {
  console.log('Renderer says:', message);
  return `pong: ${message}`;
});