import { FileNode } from '../../common/types';

/**
 * Counts total files in a tree (skipping directory nodes themselves).
 */
export function countFiles(node: FileNode): number {
  if (node.type === 'file') {
    return 1;
  }
  return (node.children ?? []).reduce((acc, child) => acc + countFiles(child), 0);
}

/**
 * Deep clones a tree or object to ensure immutability.
 */
export function cloneTree<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Flattens a tree into a list of all file nodes.
 */
export function flattenFiles(node: FileNode): FileNode[] {
  if (node.type === 'file') {
    return [node];
  }
  if (node.children) {
    return node.children.flatMap(child => flattenFiles(child));
  }
  return [];
}

/**
 * Creates a virtual directory node.
 */
export function createDirectory(name: string, children: FileNode[] = []): FileNode {
  return {
    path: `virtual://${name}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    type: 'directory',
    size: children.reduce((acc, c) => acc + c.size, 0),
    mtime: Date.now(),
    children
  };
}

/**
 * Safely parses JSON from a string that might be wrapped in markdown blocks.
 */
export function safeParseJSON<T = any>(content: string): T | null {
  try {
    // Remove markdown code blocks if present
    const clean = content.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}
