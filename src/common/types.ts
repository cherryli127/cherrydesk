export interface FileNode {
    path: string;      // Full absolute path (unique ID)
    name: string;      // Base name (e.g. "file.txt")
    type: 'file' | 'directory';
    size: number;      // In bytes
    mtime: number;     // Modified time (Ms timestamp)
    children?: FileNode[]; // Only for directories
}

export interface ScanResult {
    root: FileNode;
    fileCount: number;
    totalSize: number;
}

