import { useState } from 'react';
import { FileNode } from '../../common/types';

interface FileTreeProps {
  node: FileNode;
  onNodeDrop: (sourcePath: string, targetPath: string) => void;
  depth?: number;
}

const ArrowIcon = ({ open }: { open: boolean }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 12 12"
    className={`transition-transform ${open ? 'rotate-90' : ''}`}
  >
    <path
      d="M4 3l4 3-4 3"
      fill="none"
      stroke="#9aa0b3"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FolderIcon = ({ open }: { open: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" className={open ? 'text-[#f6c453]' : 'text-[#c2a65a]'}>
    <path
      d="M3 7h5l2 2h9a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
      fill="currentColor"
      opacity={open ? 0.95 : 0.7}
    />
  </svg>
);

const FileIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" className="text-[#d7d7d7]">
    <path
      d="M7 3h6l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
      fill="currentColor"
      opacity={0.65}
    />
  </svg>
);

export function FileTree({ node, onNodeDrop, depth = 0 }: FileTreeProps) {
  const [expanded, setExpanded] = useState(true);
  const [isOver, setIsOver] = useState(false);
  const paddingLeft = depth * 18 + 12;

  const indentation =
    depth > 0 ? (
      <div
        className="absolute left-2 top-0 bottom-0 border-l border-[#292929]"
        style={{ marginLeft: depth * 18 - 4 }}
      />
    ) : null;

  const handleDragStart = (e: React.DragEvent, path: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ path }));
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(false);
  };

  const handleDrop = (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    const data = e.dataTransfer.getData('application/json');
    setIsOver(false);
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
        className="relative flex items-center py-1.5 pl-3 pr-2 text-sm text-[#d4d4d4] hover:bg-[#232323] rounded-md cursor-grab"
        style={{ paddingLeft }}
        draggable
        onDragStart={e => handleDragStart(e, node.path)}
      >
        {indentation}
        <FileIcon />
        <span className="ml-2 truncate">{node.name}</span>
      </div>
    );
  }

  const childCount = node.children?.length ?? 0;

  return (
    <div className="relative">
      {indentation}
      <div
        className={`flex items-center py-1.5 pr-2 text-sm rounded-md select-none transition ${
          isOver
            ? 'bg-[#1f2a3d] border border-[#3f8cff]/40 shadow-[0_0_0_1px_rgba(63,140,255,0.35)]'
            : 'hover:bg-[#232323]'
        }`}
        style={{ paddingLeft }}
        onClick={() => setExpanded(!expanded)}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={e => handleDrop(e, node.path)}
      >
        <span className="mr-1 inline-flex h-4 w-4 items-center justify-center">
          <ArrowIcon open={expanded} />
        </span>
        <span className="mr-2">
          <FolderIcon open={expanded} />
        </span>
        <span className="flex-1 truncate font-medium text-[#f5f5f5]">{node.name}</span>
        <span className="text-[10px] text-[#8c8c8c] bg-[#222] px-1.5 py-0.5 rounded-full">{childCount}</span>
      </div>
      {expanded && node.children && (
        <div className="ml-2 border-l border-[#1f1f1f]">
          {node.children.map(child => (
            <FileTree key={`${child.path}:${child.name}`} node={child} onNodeDrop={onNodeDrop} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

