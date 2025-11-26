import { FileNode } from '../../common/types';

export function findNode(nodes: FileNode[], path: string): FileNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNode(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

export function removeNode(nodes: FileNode[], path: string): FileNode[] {
  return nodes.filter(node => {
    if (node.path === path) return false;
    if (node.children) {
      node.children = removeNode(node.children, path);
    }
    return true;
  });
}

export function addNodeToTarget(nodes: FileNode[], targetPath: string, nodeToAdd: FileNode): FileNode[] {
  return nodes.map(node => {
    if (node.path === targetPath) {
      return {
        ...node,
        children: [...(node.children || []), nodeToAdd]
      };
    }
    if (node.children) {
      return {
        ...node,
        children: addNodeToTarget(node.children, targetPath, nodeToAdd)
      };
    }
    return node;
  });
}

export function moveFileInTree(roots: FileNode[], sourcePath: string, targetPath: string): FileNode[] {
  // 1. Find the node to move
  const nodeToMove = findNode(roots, sourcePath);
  if (!nodeToMove) return roots;

  // 2. Remove it from old location
  // We clone first to avoid mutation issues if not handling immutable correctly above
  const rootsWithoutSource = removeNode(JSON.parse(JSON.stringify(roots)), sourcePath);

  // 3. Add to new location
  return addNodeToTarget(rootsWithoutSource, targetPath, nodeToMove);
}

