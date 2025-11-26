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

const countFiles = (node: FileNode): number =>
  node.type === 'file'
    ? 1
    : (node.children ?? []).reduce((acc, child) => acc + countFiles(child), 0);

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

  const pendingSummary = useMemo(() => {
    if (!snapshotTree || !workingTree) return null;
    const files = workingTree.reduce((acc, root) => acc + countFiles(root), 0);
    return { roots: workingTree.length, files };
  }, [snapshotTree, workingTree]);

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
    <div className="min-h-screen bg-[#0f1219] text-[#f5f5f5] p-8">
      <div className="mx-auto w-full max-w-5xl rounded-3xl bg-[#131722] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.45)] border border-[#1c2130]">
        <header className="mb-8 flex flex-col gap-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#6a7b9f]">Workspace</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white">CherryDesk Organizer</h1>
              <p className="text-sm text-[#95a4c0]">
                Capture a point-zero snapshot, preview smart grouping strategies, and apply with confidence.
              </p>
            </div>
            <span className="rounded-full border border-[#28406c] bg-[#162039] px-3 py-1 text-[11px] text-[#9ec4ff] inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#35d59d]" />
              100% local
            </span>
          </div>
        </header>

        <section className="rounded-2xl border border-[#1e2536] bg-[#0f1420] p-5 shadow-inner shadow-black/30">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-[#e7e8ef]">
              <div className="h-5 w-6 rounded-[6px] bg-gradient-to-br from-[#f6c453] to-[#f29f3f] flex items-center justify-center text-[10px] text-[#2a1800] font-semibold">
                FS
              </div>
              <span className="font-semibold tracking-wide">Local Sources</span>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-full border border-[#2d3c55] bg-[#11182a] px-4 py-2 text-xs text-white transition hover:border-[#3f8cff]"
                onClick={handleConnectFolder}
              >
                Connect folder
              </button>
              <button
                className="rounded-full border border-[#2d3c55] bg-[#11182a] px-4 py-2 text-xs text-white opacity-40 cursor-not-allowed"
                disabled
              >
                Connect file
              </button>
            </div>
          </div>

          <div className="mb-2 flex flex-col gap-2 text-[11px] text-[#8ea0c0] sm:flex-row sm:items-center sm:justify-between">
            <span>Folders</span>
            <div className="flex items-center gap-3">
              <span className="text-[#b8c6e3]">{selectedCount} selected</span>
              <button className="text-[#8fb9ff] hover:underline" type="button" onClick={handleSelectAll}>
                Select all
              </button>
              <button className="text-[#8fb9ff] hover:underline" type="button" onClick={handleClear}>
                Clear
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-auto rounded-2xl border border-[#171d2c] bg-[#0b111c]">
            {folders.length === 0 ? (
              <div className="px-6 py-8 text-sm text-center text-[#6b7a99]">
                No folders connected yet. Click “Connect folder” to get started.
              </div>
            ) : (
              folders.map((folder, index) => (
                <div
                  key={folder.path}
                  className="flex items-center gap-3 border-b border-[#161b28] px-5 py-3 text-sm last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={folder.selected}
                    onChange={() => toggleFolderSelection(index)}
                    className="accent-[#3f8cff]"
                  />
                  <div className="h-4 w-5 rounded-[4px] bg-gradient-to-br from-[#f6c453] to-[#f29f3f]" />
                  <span className="flex-1 truncate text-[#dbe3ff]">{folder.path}</span>
                  <span className="text-[11px] text-[#7f8aab]">
                    {typeof folder.fileCount === 'number' ? `${folder.fileCount} files` : ''}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 text-[11px] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-[#8f9ebb]">
              <span className="h-2 w-2 rounded-full bg-[#3f8cff]" />
              <span>{footerText}</span>
            </div>
            <div className="flex gap-2">
              <button className="rounded-full border border-[#2b3549] px-4 py-2 text-xs text-white" onClick={handleCancel}>
                Reset
              </button>
              <button
                className="rounded-full bg-gradient-to-r from-[#3f8cff] to-[#728bff] px-6 py-2 text-xs font-semibold text-white disabled:bg-[#1f2b45] disabled:text-[#6c7899]"
                onClick={handleConfirm}
                disabled={selectedCount === 0 || isIndexing}
              >
                {isIndexing ? 'Scanning…' : 'Capture snapshot'}
              </button>
            </div>
          </div>

          {statusInfo && (
            <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-[#1a2131] bg-[#0b111c] px-4 py-3 text-[12px] text-[#c7d7ff] sm:flex-row sm:items-center sm:justify-between">
              <span>{statusInfo.left}</span>
              <span className="text-[#8fb9ff]">{statusInfo.right}</span>
            </div>
          )}
        </section>

        {snapshotTree && strategies.length > 0 && (
          <section className="mt-8 rounded-2xl border border-[#1e2536] bg-[#0f1420] p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Organize Preview</h3>
                <p className="text-sm text-[#8da0c6]">Try a strategy, drag to adjust, then apply once you’re satisfied.</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  title="Pick how CherryDesk reshapes your folders"
                  className="rounded-lg border border-[#274169] bg-[#10192b] px-3 py-2 text-sm text-white focus:border-[#3f8cff] focus:outline-none focus:ring-1 focus:ring-[#3f8cff]"
                  value={selectedStrategyId}
                  onChange={e => setSelectedStrategyId(e.target.value)}
                  disabled={isExecuting}
                >
                  {strategies.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  className="rounded-lg bg-gradient-to-r from-[#3f8cff] to-[#7f6bff] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-40"
                  onClick={handlePreview}
                  disabled={isPreviewing || isExecuting}
                >
                  {isPreviewing ? 'Analyzing…' : 'Preview'}
                </button>
              </div>
            </div>

            <p className="mt-3 text-xs text-[#7c8db3]">
              {strategies.find(s => s.id === selectedStrategyId)?.description}
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <article className="rounded-xl border border-[#1a2131] bg-[#111726] p-4">
                <header className="mb-3 flex items-center justify-between text-xs uppercase tracking-wide text-[#6e7d9f]">
                  <span>Current Structure</span>
                  <span className="text-[10px] text-[#8a96b5]">Point zero snapshot</span>
                </header>
                <div className="space-y-3 overflow-auto rounded-lg bg-[#0b0f18] p-3 max-h-[26rem]">
                  {snapshotTree.map(res => (
                    <div key={res.root.path}>
                      <p className="text-[11px] text-[#5f739a] mb-1">{res.root.path}</p>
                      <FileTree node={res.root} onNodeDrop={() => { }} />
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-xl border border-[#1a2131] bg-[#111726] p-4">
                <header className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#6e7d9f]">Proposed Structure</p>
                    {pendingSummary && (
                      <p className="text-[11px] text-[#a1b5dd]">
                        {pendingSummary.files} items staged across {pendingSummary.roots} root(s)
                      </p>
                    )}
                  </div>
                  {workingTree && (
                    <div className="flex items-center gap-2">
                      {canUndo && (
                        <button
                          onClick={handleUndo}
                          disabled={isExecuting}
                          className="rounded-lg border border-[#ff7373]/40 px-3 py-1 text-xs text-[#ff9b9b] hover:bg-[#2b1313]"
                        >
                          Undo last
                        </button>
                      )}
                      <button
                        onClick={handleApply}
                        disabled={isExecuting}
                        className="rounded-lg bg-[#32c59e] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#0a1f16] disabled:bg-[#2b4b40]"
                      >
                        {isExecuting ? 'Applying…' : 'Apply'}
                      </button>
                    </div>
                  )}
                </header>
                <div className="space-y-3 overflow-auto rounded-lg bg-[#0b0f18] p-3 max-h-[26rem]">
                  {workingTree ? (
                    workingTree.map(root => (
                      <FileTree key={root.path} node={root} onNodeDrop={handleMoveNode} />
                    ))
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-[#1f2b42] text-[12px] text-[#60719b]">
                      Preview a strategy to see the proposed layout
                    </div>
                  )}
                </div>
              </article>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
