import { OrganizationStrategy } from '../../common/strategy';
import { FileNode } from '../../common/types';
import { flattenFiles, createDirectory, cloneTree } from '../utils/treeHelpers';

export const TimeStrategy: OrganizationStrategy = {
    id: 'time',
    name: 'Organize by Time',
    description: 'Groups files by Year and Month (YYYY/MM).',

    async apply(root: FileNode): Promise<FileNode> {
        const files = flattenFiles(root);
        const groups: Record<string, Record<string, FileNode[]>> = {}; // year -> month -> files

        for (const file of files) {
            const date = new Date(file.mtime);
            const year = date.getFullYear().toString();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');

            if (!groups[year]) groups[year] = {};
            if (!groups[year][month]) groups[year][month] = [];

            groups[year][month].push(cloneTree(file));
        }

        const newChildren: FileNode[] = [];

        const sortedYears = Object.keys(groups).sort().reverse();
        for (const year of sortedYears) {
            const monthNodes: FileNode[] = [];
            const sortedMonths = Object.keys(groups[year]).sort().reverse();

            for (const month of sortedMonths) {
                monthNodes.push(createDirectory(month, groups[year][month]));
            }

            newChildren.push(createDirectory(year, monthNodes));
        }

        return {
            ...cloneTree(root),
            children: newChildren
        };
    }
};
