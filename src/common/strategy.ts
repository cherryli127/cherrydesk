import { FileNode } from './types';

export interface OrganizationStrategy {
    id: string;
    name: string;
    description: string;
    /**
     * Applies the strategy to the given file tree.
     * Returns a NEW root node with the reorganized structure.
     * Must not mutate the input tree.
     */
    apply(root: FileNode): Promise<FileNode>;
}

