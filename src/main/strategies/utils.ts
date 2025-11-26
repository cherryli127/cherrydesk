import { FileNode } from '../../common/types';

export function flattenFiles(node: FileNode): FileNode[] {
    if (node.type === 'file') {
        return [node];
    }

    if (node.children) {
        return node.children.flatMap(child => flattenFiles(child));
    }

    return [];
}

export function cloneNode(node: FileNode): FileNode {
    return JSON.parse(JSON.stringify(node));
}

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
