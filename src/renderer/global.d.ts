export {};

import { ScanResult, FileNode } from '../common/types';

interface FolderCount {
  folder: string;
  count: number;
}

interface CountResult {
  perFolder: FolderCount[];
  total: number;
}

interface StrategyInfo {
  id: string;
  name: string;
  description: string;
}

interface ExecutionResult {
    success: boolean;
    processed: number;
    errors: string[];
}

declare global {
  interface Window {
    api: {
      selectFolders: () => Promise<string[]>;
      countFiles: (folders: string[]) => Promise<CountResult>;
      scanFolders: (folders: string[]) => Promise<ScanResult[]>;
      previewOrganization: (strategyId: string, root: FileNode) => Promise<FileNode>;
      getStrategies: () => Promise<StrategyInfo[]>;
      executeOrganization: (rootPath: string, workingTreeRoot: FileNode) => Promise<ExecutionResult>;
      undoLastBatch: () => Promise<ExecutionResult>;
      ping: (message: string) => Promise<string>;
    };
  }
}
