import React, { useState } from 'react';
import { FileNode } from '../../common/types';

interface FileTreeProps {
  node: FileNode;
  onNodeDrop: (sourcePath: string, targetPath: string) => void;
  depth?: number;
}

export function FileTree({ node, onNodeDrop, depth = 0 }: FileTreeProps) {
  const [expanded, setExpanded] = useState(true);
  const paddingLeft = depth * 20 + 12;

  const handleDragStart = (e: React.DragEvent, path: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ path }));
    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    const data = e.dataTransfer.getData('application/json');
    if (data) {
      const { path: sourcePath } = JSON.parse(data);
      if (sourcePath !== targetPath) {
        onNodeDrop(sourcePath, targetPath);
      }
    }
  };

  if (node.type === 'file') {
    return (
      <div 
        className="flex items-center py-1 hover:bg-[#2a2a2a] cursor-grab text-[#d4d4d4]"
        style={{ paddingLeft }}
        draggable
        onDragStart={(e) => handleDragStart(e, node.path)}
      >
        <span className="mr-2 text-xs">📄</span>
        <span className="truncate">{node.name}</span>
      </div>
    );
  }

  return (
    <div>
      <div 
        className="flex items-center py-1 hover:bg-[#2a2a2a] cursor-pointer text-[#e5e5e5]"
        style={{ paddingLeft }}
        onClick={() => setExpanded(!expanded)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, node.path)}
      >
        <span className="mr-2 text-xs text-[#888]">{expanded ? '▼' : '▶'}</span>
        <span className="mr-2 text-xs text-[#f6c453]">📁</span>
        <span className="truncate font-medium">{node.name}</span>
        <span className="ml-2 text-[10px] text-[#666]">
             ({node.children?.length || 0})
        </span>
      </div>
      {expanded && node.children && (
        <div>
          {node.children.map(child => (
            <FileTree 
              key={child.path + child.name} 
              node={child} 
              onNodeDrop={onNodeDrop}
              depth={depth + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

