export {};

interface FolderCount {
  folder: string;
  count: number;
}

interface CountResult {
  perFolder: FolderCount[];
  total: number;
}

declare global {
  interface Window {
    api: {
      selectFolders: () => Promise<string[]>;
      countFiles: (folders: string[]) => Promise<CountResult>;
      ping: (message: string) => Promise<string>;
    };
  }
}