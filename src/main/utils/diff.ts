import { FileNode } from '../../common/types';
import * as path from 'path';

export interface FileOperation {
    type: 'move';
    source: string;
    destination: string;
}

export function calculateDiff(rootPath: string, workingTreeRoot: FileNode): FileOperation[] {
    const operations: FileOperation[] = [];

    function traverse(node: FileNode, currentPath: string) {
        if (node.type === 'file') {
            const destination = path.join(currentPath, node.name);
            // Compare normalized paths
            if (path.resolve(node.path) !== path.resolve(destination)) {
                operations.push({
                    type: 'move',
                    source: node.path,
                    destination: destination
                });
            }
        } else if (node.children) {
            // Determine the path for this directory
            // If it's a virtual node or a restructured node, we build upon the currentPath
            // The name of the node in the working tree is the directory name
            const newDir = path.join(currentPath, node.name);
            for (const child of node.children) {
                traverse(child, newDir);
            }
        }
    }

    // The workingTreeRoot itself might be the root folder (e.g. /Users/me/Downloads)
    // OR it might be a wrapper. 
    // If the user selected /Users/me/Downloads, the root node has name "Downloads".
    // We assume the root of the working tree corresponds to the root of the scan.
    // So we start traversing children relative to the root's PARENT?
    
    // Actually, the strategies return a modified Root Node.
    // The Root Node usually keeps its name and path?
    // If TimeStrategy runs on /Downloads, it returns a Node "Downloads" with children "2024", "2023".
    // So the base path is the *parent* of the root.
    
    const rootParent = path.dirname(rootPath);
    
    // If the root node name changed (unlikely for root), or we just treat it as the anchor.
    // We expect workingTreeRoot.path to equal rootPath (mostly).
    
    // If the root is "Downloads", we traverse its children with base "/Users/me/Downloads"
    
    if (workingTreeRoot.children) {
        for (const child of workingTreeRoot.children) {
            traverse(child, rootPath);
        }
    }

    return operations;
}

