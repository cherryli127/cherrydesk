import { useEffect, useMemo, useState } from 'react';
import { ScanResult, FileNode } from '../common/types';
import { FileTree } from './components/FileTree';
import { moveFileInTree } from './utils/treeUtils';

interface FolderItem {
  path: string;
  selected: boolean;
  fileCount?: number;
}

interface StatusInfo {
  left: string;
  right: string;
}

interface StrategyInfo {
  id: string;
  name: string;
  description: string;
}

function defaultFooterText(folders: FolderItem[]): string {
  if (folders.length === 0) {
    return 'Waiting for folders…';
  }
  const selected = folders.filter(f => f.selected).length;
  if (selected === 0) {
    return 'Select at least one folder to index.';
  }
  return 'Ready to index selected folders.';
}

export default function App() {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [statusInfo, setStatusInfo] = useState<StatusInfo | null>(null);
  const [customFooterText, setCustomFooterText] = useState<string | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);

  // State for the point-zero snapshot and working tree
  const [snapshotTree, setSnapshotTree] = useState<ScanResult[] | null>(null);
  const [workingTree, setWorkingTree] = useState<FileNode[] | null>(null);

  // Strategy State
  const [strategies, setStrategies] = useState<StrategyInfo[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('');
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    // Load strategies on mount
    if (window.api?.getStrategies) {
      window.api.getStrategies().then(list => {
        setStrategies(list);
        if (list.length > 0) setSelectedStrategyId(list[0].id);
      });
    }
  }, []);

  const selectedCount = useMemo(
    () => folders.filter(folder => folder.selected).length,
    [folders]
  );

  const footerText = customFooterText ?? defaultFooterText(folders);

  const updateFolders = (
    updater: (current: FolderItem[]) => FolderItem[],
    options?: { clearStatus?: boolean }
  ) => {
    setFolders(prev => updater(prev));
    setCustomFooterText(null);
    if (options?.clearStatus) {
      setStatusInfo(null);
      setSnapshotTree(null);
      setWorkingTree(null);
      setCanUndo(false);
    }
  };

  const handleConnectFolder = async () => {
    if (!window?.api?.selectFolders) return;
    const paths = await window.api.selectFolders();
    if (!paths?.length) return;

    updateFolders(
      prev => {
        const existing = new Set(prev.map(item => item.path));
        const next = [...prev];
        for (const path of paths) {
          if (!existing.has(path)) {
            next.push({ path, selected: true });
          }
        }
        return next.map(folder => ({ ...folder, fileCount: undefined }));
      },
      { clearStatus: true }
    );
  };

  const handleSelectAll = () => {
    if (!folders.length) return;
    updateFolders(prev => prev.map(folder => ({ ...folder, selected: true })));
  };

  const handleClear = () => {
    updateFolders(() => [], { clearStatus: true });
  };

  const handleCancel = () => {
    if (!folders.length) return;
    updateFolders(
      prev =>
        prev.map(folder => ({
          ...folder,
          selected: true,
          fileCount: undefined,
        })),
      { clearStatus: true }
    );
  };

  const toggleFolderSelection = (index: number) => {
    updateFolders(prev =>
      prev.map((folder, idx) =>
        idx === index ? { ...folder, selected: !folder.selected } : folder
      )
    );
  };

  const handleConfirm = async () => {
    if (!window?.api?.scanFolders) return;
    const selected = folders.filter(folder => folder.selected);
    if (!selected.length) return;

    setIsIndexing(true);
    setCustomFooterText('Scanning…');
    setStatusInfo(null);
    setSnapshotTree(null);
    setWorkingTree(null);
    setCanUndo(false);

    try {
      const results = await window.api.scanFolders(selected.map(f => f.path));

      setSnapshotTree(results);

      setFolders(prev =>
        prev.map(folder => {
          const target = results.find(
            item => item.root.path === folder.path
          );
          return {
            ...folder,
            fileCount: target?.fileCount,
          };
        })
      );

      const totalFiles = results.reduce((acc, r) => acc + r.fileCount, 0);

      setStatusInfo({
        left: `Snapshot captured: ${totalFiles} files found.`,
        right: `Scanned ${results.length} folder(s).`,
      });
      setCustomFooterText('Ready to organize.');
    } catch (error: unknown) {
      setStatusInfo({
        left: 'Failed to scan folders.',
        right: error instanceof Error ? error.message : String(error),
      });
      setCustomFooterText('Something went wrong.');
    } finally {
      setIsIndexing(false);
    }
  };

  const handlePreview = async () => {
    if (!snapshotTree || !selectedStrategyId) return;

    setIsPreviewing(true);
    setCustomFooterText('Analyzing and reorganizing...');

    try {
      // Apply strategy to each root independently
      const newRoots = await Promise.all(
        snapshotTree.map(res => window.api.previewOrganization(selectedStrategyId, res.root))
      );
      setWorkingTree(newRoots);
      setCustomFooterText('Preview ready. Drag & drop to adjust.');
    } catch (error) {
      console.error(error);
      setStatusInfo({
        left: 'Organization failed.',
        right: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleMoveNode = (sourcePath: string, targetPath: string) => {
    if (!workingTree) return;
    const newTree = moveFileInTree(workingTree, sourcePath, targetPath);
    setWorkingTree(newTree);
  };

  const handleApply = async () => {
    if (!workingTree || !snapshotTree) return;
    if (!window.confirm('Are you sure you want to move files? This will change your file system.')) return;

    setIsExecuting(true);
    setCustomFooterText('Moving files...');

    try {
      let totalProcessed = 0;
      const allErrors: string[] = [];

      // Execute for each root
      for (let i = 0; i < workingTree.length; i++) {
        const rootPath = snapshotTree[i].root.path; // Original root path
        const virtualRoot = workingTree[i]; // Proposed structure

        const result = await window.api.executeOrganization(rootPath, virtualRoot);
        if (!result.success) {
          allErrors.push(...result.errors);
        }
        totalProcessed += result.processed;
      }

      if (allErrors.length > 0) {
        setStatusInfo({
          left: `Moved ${totalProcessed} files with errors.`,
          right: `${allErrors.length} errors occurred.`
        });
        console.error(allErrors);
      } else {
        setStatusInfo({
          left: 'Organization complete.',
          right: `Successfully moved ${totalProcessed} files.`
        });
        setCustomFooterText('Done.');
      }
      setCanUndo(true);

      // Refresh the scan to reflect reality
      // handleConfirm(); // Optional: re-scan immediately

    } catch (error) {
      setStatusInfo({
        left: 'Execution failed.',
        right: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleUndo = async () => {
    if (!window.confirm('Undo last operation?')) return;

    setIsExecuting(true);
    setCustomFooterText('Reverting changes...');

    try {
      const result = await window.api.undoLastBatch();
      if (result.success) {
        setStatusInfo({
          left: 'Undo successful.',
          right: `Reverted ${result.processed} files.`
        });
        setCanUndo(false);
        // Re-scan?
      } else {
        setStatusInfo({
          left: 'Undo failed.',
          right: result.errors.join(', ')
        });
      }
    } catch (error) {
      setStatusInfo({
        left: 'Undo failed.',
        right: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-[#f5f5f5] p-6">
      <div className="mx-auto w-full max-w-4xl rounded-2xl bg-[#1e1e1e] p-6 shadow-2xl shadow-black/40">
        <header className="mb-6 flex flex-col gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold">Connect Sources</span>
              <span className="rounded-full border border-[#3f8cff] px-2 text-[11px] text-[#9ec4ff]">
                100% local
              </span>
            </div>
            <p className="text-xs text-[#a0a0a0]">
              Connect your local folders and let CherryDesk index them.
            </p>
          </div>
        </header>

        <section className="rounded-xl border border-[#2a2a2a] bg-[#181818] p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm">
              <div className="h-4 w-5 rounded-[4px] bg-gradient-to-br from-[#f6c453] to-[#f29f3f]">
                <div className="ml-1 mt-[-3px] h-1 w-2 rounded-t bg-[#f9d58c]" />
              </div>
              <span className="font-medium">Local Folder</span>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-full border border-[#3a3a3a] bg-[#222222] px-4 py-1 text-xs text-white transition hover:bg-[#2a2a2a]"
                onClick={handleConnectFolder}
              >
                Connect folder
              </button>
              <button
                className="rounded-full border border-[#3a3a3a] bg-[#222222] px-4 py-1 text-xs text-white opacity-40"
                disabled
              >
                Connect file
              </button>
            </div>
          </div>

          <div className="mb-2 flex flex-col gap-2 text-[11px] text-[#a0a0a0] sm:flex-row sm:items-center sm:justify-between">
            <span>Folders</span>
            <div className="flex items-center gap-3">
              <span>{selectedCount} selected</span>
              <button
                className="text-[#c8d4ff] hover:underline"
                type="button"
                onClick={handleSelectAll}
              >
                Select all
              </button>
              <button
                className="text-[#c8d4ff] hover:underline"
                type="button"
                onClick={handleClear}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-auto rounded-xl border border-[#262626] bg-[#151515]">
            {folders.length === 0 ? (
              <div className="px-4 py-5 text-sm text-[#7c7c7c]">
                No folders connected yet. Click “Connect folder” to get started.
              </div>
            ) : (
              folders.map((folder, index) => (
                <div
                  key={folder.path}
                  className="flex items-center gap-3 border-b border-[#262626] px-4 py-2 text-sm last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={folder.selected}
                    onChange={() => toggleFolderSelection(index)}
                    className="accent-[#3f8cff]"
                  />
                  <div className="h-3 w-4 rounded-[3px] bg-gradient-to-br from-[#f6c453] to-[#f29f3f]" />
                  <span className="flex-1 truncate">{folder.path}</span>
                  <span className="text-[11px] text-[#8f8f8f]">
                    {typeof folder.fileCount === 'number'
                      ? `${folder.fileCount} files`
                      : ''}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 text-[11px] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-[#8f8f8f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3f8cff]" />
              <span>{footerText}</span>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-full border border-[#3a3a3a] px-4 py-1 text-xs text-white"
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-[#3f8cff] px-5 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                onClick={handleConfirm}
                disabled={selectedCount === 0 || isIndexing}
              >
                {isIndexing ? 'Scanning…' : 'Confirm'}
              </button>
            </div>
          </div>

          {statusInfo && (
            <div className="mt-3 flex flex-col gap-2 rounded-xl border border-[#262626] bg-[#151515] px-4 py-3 text-[11px] sm:flex-row sm:items-center sm:justify-between">
              <span>{statusInfo.left}</span>
              <span className="text-[#c8d4ff]">{statusInfo.right}</span>
            </div>
          )}
        </section>

        {/* Organization Section */}
        {snapshotTree && strategies.length > 0 && (
          <section className="mt-6 rounded-xl border border-[#2a2a2a] bg-[#181818] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium">Organize Files</h3>
              <div className="flex items-center gap-3">
                <select
                  className="bg-[#222] border border-[#3a3a3a] text-xs rounded-md px-2 py-1 text-white outline-none focus:border-[#3f8cff]"
                  value={selectedStrategyId}
                  onChange={(e) => setSelectedStrategyId(e.target.value)}
                >
                  {strategies.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <button
                  className="rounded-full bg-[#3f8cff] px-4 py-1 text-xs font-medium text-white disabled:opacity-50"
                  onClick={handlePreview}
                  disabled={isPreviewing || isExecuting}
                >
                  {isPreviewing ? 'Thinking...' : 'Preview'}
                </button>
              </div>
            </div>

            <div className="text-xs text-[#888] mb-4">
              {strategies.find(s => s.id === selectedStrategyId)?.description}
            </div>

            <div className="grid grid-cols-2 gap-4 h-96">
              {/* Before View */}
              <div className="border border-[#262626] rounded-lg bg-[#151515] flex flex-col">
                <div className="p-2 border-b border-[#262626] text-xs font-medium text-[#888]">Current Structure</div>
                <div className="flex-1 overflow-auto p-2">
                  {snapshotTree.map(res => (
                    <div key={res.root.path} className="mb-2">
                      <div className="text-[#666] text-[10px] px-2 py-1 font-mono">{res.root.path}</div>
                      <FileTree node={res.root} onNodeDrop={() => { }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* After View */}
              <div className="border border-[#262626] rounded-lg bg-[#151515] flex flex-col">
                <div className="p-2 border-b border-[#262626] text-xs font-medium text-[#3f8cff] flex justify-between items-center">
                  <span>Proposed Structure</span>
                  {workingTree && (
                    <div className="flex gap-2">
                      {canUndo && (
                        <button
                          onClick={handleUndo}
                          disabled={isExecuting}
                          className="text-[10px] underline text-[#ff6b6b]"
                        >
                          Undo
                        </button>
                      )}
                      <button
                        onClick={handleApply}
                        disabled={isExecuting}
                        className="bg-[#3f8cff] text-white px-2 py-0.5 rounded text-[10px]"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-auto p-2">
                  {workingTree ? (
                    workingTree.map(root => (
                      <div key={root.path} className="mb-2">
                        <FileTree node={root} onNodeDrop={handleMoveNode} />
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex items-center justify-center text-[#444] text-xs">
                      Click "Preview" to see the organized structure
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
