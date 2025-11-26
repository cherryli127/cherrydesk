import { OrganizationStrategy } from '../../common/strategy';
import { FileNode } from '../../common/types';
import { flattenFiles, createDirectory, cloneNode } from './utils';
import * as path from 'path';

const TYPE_MAPPING: Record<string, string[]> = {
    'Images': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'],
    'Documents': ['.pdf', '.doc', '.docx', '.txt', '.md', '.xls', '.xlsx', '.ppt', '.pptx'],
    'Audio': ['.mp3', '.wav', '.ogg', '.m4a', '.flac'],
    'Video': ['.mp4', '.mkv', '.mov', '.avi', '.webm'],
    'Code': ['.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.json', '.py', '.java', '.c', '.cpp', '.go', '.rs'],
    'Archives': ['.zip', '.rar', '.7z', '.tar', '.gz'],
};

function getCategory(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    for (const [category, exts] of Object.entries(TYPE_MAPPING)) {
        if (exts.includes(ext)) return category;
    }
    return 'Others';
}

export const TypeStrategy: OrganizationStrategy = {
    id: 'type',
    name: 'Organize by Type',
    description: 'Groups files by category (Images, Documents, etc.).',

    async apply(root: FileNode): Promise<FileNode> {
        const files = flattenFiles(root);
        const groups: Record<string, FileNode[]> = {};

        for (const file of files) {
            const category = getCategory(file.name);
            if (!groups[category]) groups[category] = [];
            groups[category].push(cloneNode(file));
        }

        const newChildren: FileNode[] = [];

        // Fixed order for common categories, then alphabetical
        const order = ['Images', 'Documents', 'Video', 'Audio', 'Code', 'Archives', 'Others'];
        const existingCategories = Object.keys(groups);

        // Sort existing categories based on 'order'
        existingCategories.sort((a, b) => {
            const idxA = order.indexOf(a);
            const idxB = order.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });

        for (const category of existingCategories) {
            newChildren.push(createDirectory(category, groups[category]));
        }

        return {
            ...cloneNode(root),
            children: newChildren
        };
    }
};

