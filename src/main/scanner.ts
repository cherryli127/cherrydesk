import * as fs from 'fs/promises';
import * as path from 'path';
import { FileNode, ScanResult } from '../common/types';

/**
 * Recursively scans a directory and builds a FileNode tree.
 * Skips files/directories that cannot be accessed.
 */
async function scanNode(currentPath: string): Promise<{ node: FileNode; count: number; size: number } | null> {
    try {
        const stats = await fs.stat(currentPath);
        const name = path.basename(currentPath);
        const mtime = stats.mtimeMs;

        if (stats.isFile()) {
            return {
                node: {
                    path: currentPath,
                    name,
                    type: 'file',
                    size: stats.size,
                    mtime
                },
                count: 1,
                size: stats.size
            };
        } else if (stats.isDirectory()) {
            let entries: string[] = [];
            try {
                entries = await fs.readdir(currentPath);
            } catch (err) {
                console.warn(`Failed to read directory ${currentPath}:`, err);
                return null; // Skip unreadable directories
            }

            const children: FileNode[] = [];
            let totalCount = 0; // Don't count the directory itself as a file
            let totalSize = 0;

            // Process children concurrently
            const results = await Promise.all(
                entries.map(entry => scanNode(path.join(currentPath, entry)))
            );

            for (const result of results) {
                if (result) {
                    children.push(result.node);
                    totalCount += result.count;
                    totalSize += result.size;
                }
            }

            // Sort children: directories first, then files
            children.sort((a, b) => {
                if (a.type === b.type) return a.name.localeCompare(b.name);
                return a.type === 'directory' ? -1 : 1;
            });

            return {
                node: {
                    path: currentPath,
                    name,
                    type: 'directory',
                    size: totalSize, // Directory size = sum of content
                    mtime,
                    children
                },
                count: totalCount,
                size: totalSize
            };
        }

        return null; // Ignore other types (symlinks, sockets, etc. for now)
    } catch (error) {
        console.warn(`Failed to access ${currentPath}:`, error);
        return null;
    }
}

export async function scanDirectory(dirPath: string): Promise<ScanResult> {
    const result = await scanNode(dirPath);

    if (!result) {
        throw new Error(`Failed to scan directory: ${dirPath}`);
    }

    return {
        root: result.node,
        fileCount: result.count,
        totalSize: result.size
    };
}

