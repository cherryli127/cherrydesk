export { };

import { ScanResult, FileNode } from '../common/types';
import { ModelProviderConfig } from '../common/modelProvider';

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
      getModelProviderConfig: () => Promise<ModelProviderConfig | null>;
      saveModelProviderConfig: (config: ModelProviderConfig) => Promise<void>;
      testModelProviderConfig: (config: ModelProviderConfig) => Promise<{ success: boolean; message: string }>;
      onModelProviderConfigUpdated: (callback: (config: ModelProviderConfig) => void) => () => void;
      ping: (message: string) => Promise<string>;
    };
  }
}
