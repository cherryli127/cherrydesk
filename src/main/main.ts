import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { scanDirectory } from './scanner';
import { getStrategy, strategies } from './strategies';
import { FileNode } from '../common/types';
import { calculateDiff } from './utils/diff';
import { BatchExecutor } from './executor';
import { ModelProviderConfig, getDefaultModelProviderConfig } from '../common/modelProvider';

const DIST_ROOT = path.resolve(__dirname, '..', '..');
const RENDERER_DIST_PATH = path.join(DIST_ROOT, 'renderer');
const PROJECT_ROOT = path.resolve(DIST_ROOT, '..');

// Load .env file if it exists
try {
  const envPath = path.join(PROJECT_ROOT, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
  }
} catch (e) {
  console.error('[Main] Failed to load .env:', e);
}

let mainWindow: BrowserWindow | null = null;
const executor = new BatchExecutor();

const MODEL_PROVIDER_FILENAME = 'model-provider-config.json';
let cachedModelProviderConfig: ModelProviderConfig | null = null;

function getModelProviderConfigPath(): string {
  return path.join(app.getPath('userData'), MODEL_PROVIDER_FILENAME);
}

function readModelProviderConfigFromDisk(): ModelProviderConfig | null {
  try {
    const configPath = getModelProviderConfigPath();
    console.log('[ModelProvider] Loading config from:', configPath);
    if (!fs.existsSync(configPath)) {
      return null;
    }
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw) as ModelProviderConfig;
    console.log('[ModelProvider] Loaded config:', { ...config, apiKey: config.apiKey ? '***' : 'empty' });
    return config;
  } catch (error) {
    console.error('[ModelProvider] Failed to read config:', error);
    return null;
  }
}

function getPersistedModelProviderConfig(): ModelProviderConfig {
  if (!cachedModelProviderConfig) {
    cachedModelProviderConfig = readModelProviderConfigFromDisk() ?? getDefaultModelProviderConfig();
  }
  return cachedModelProviderConfig;
}

function persistModelProviderConfig(config: ModelProviderConfig): void {
  try {
    const configPath = getModelProviderConfigPath();
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    cachedModelProviderConfig = config;
    console.log('[ModelProvider] Saved config:', { ...config, apiKey: config.apiKey ? '***' : 'empty' });
  } catch (error) {
    console.error('[ModelProvider] Failed to save config:', error);
    throw error;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(RENDERER_DIST_PATH, 'index.html'));

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

/** 获取模型提供商配置 */
ipcMain.handle('get-model-provider-config', async (): Promise<ModelProviderConfig | null> => {
  try {
    return getPersistedModelProviderConfig();
  } catch (error) {
    console.error('[Main] Failed to load model provider config:', error);
    return getDefaultModelProviderConfig();
  }
});

/** 保存模型提供商配置 */
ipcMain.handle('save-model-provider-config', async (_event, config: ModelProviderConfig): Promise<void> => {
  try {
    persistModelProviderConfig(config);
    // Notify renderer windows about the change so they can refresh UI state if needed
    mainWindow?.webContents.send('model-provider-config-updated', config);
  } catch (error) {
    console.error('[Main] Failed to save model provider config:', error);
    throw new Error(`Failed to save config: ${error instanceof Error ? error.message : String(error)}`);
  }
});

/** 测试模型提供商连接 */
ipcMain.handle('test-model-provider-config', async (_event, config: ModelProviderConfig): Promise<{ success: boolean; message: string }> => {
  try {
    const { createLLMClient } = await import('../llm/factory');
    const client = createLLMClient({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      model: config.defaultModel,
    });

    if (!client) {
      return { success: false, message: 'Failed to create LLM client: Missing API key' };
    }

    // Test with a simple chat completion request - send "Hello, world!"
    console.log('[Test Connection] Sending test request to:', config.baseURL);
    console.log('[Test Connection] Using model:', config.defaultModel);
    const response = await client.chat([
      { role: 'user', content: 'Hello, world!' }
    ], {
      model: config.defaultModel,
      max_tokens: 20,
    });

    console.log('[Test Connection] Response received:', JSON.stringify(response, null, 2));

    if (response && response.choices && response.choices.length > 0) {
      const assistantMessage = response.choices[0].message.content;
      const successMessage = `Connection successful! API key and endpoint are valid. Response: "${assistantMessage?.substring(0, 50)}${assistantMessage && assistantMessage.length > 50 ? '...' : ''}"`;
      console.log('[Test Connection] Success:', successMessage);
      return {
        success: true,
        message: successMessage
      };
    } else {
      console.error('[Test Connection] Unexpected response format:', response);
      return { success: false, message: 'Unexpected response format from API' };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Test Connection] Failed:', errorMessage);
    return { success: false, message: `Connection failed: ${errorMessage}` };
  }
});

/** 原来的 ping 保留（可删） */
ipcMain.handle('ping', async (_event, message: string) => {
  console.log('Renderer says:', message);
  return `pong: ${message}`;
});
