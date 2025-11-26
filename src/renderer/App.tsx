import { useMemo, useState } from 'react';

interface FolderItem {
  path: string;
  selected: boolean;
  fileCount?: number;
}

interface StatusInfo {
  left: string;
  right: string;
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
    if (!window?.api?.countFiles) return;
    const selected = folders.filter(folder => folder.selected);
    if (!selected.length) return;

    setIsIndexing(true);
    setCustomFooterText('Indexing…');
    setStatusInfo(null);

    try {
      const result = await window.api.countFiles(selected.map(f => f.path));
      setFolders(prev =>
        prev.map(folder => {
          const target = result.perFolder.find(
            item => item.folder === folder.path
          );
          return {
            ...folder,
            fileCount: target?.count,
          };
        })
      );
      setStatusInfo({
        left: `Files to be connected: ${result.total} files.`,
        right: `Indexed ${result.perFolder.length} folder(s).`,
      });
      setCustomFooterText('Indexing summary ready.');
    } catch (error: unknown) {
      setStatusInfo({
        left: 'Failed to count files.',
        right: error instanceof Error ? error.message : String(error),
      });
      setCustomFooterText('Something went wrong.');
    } finally {
      setIsIndexing(false);
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
                {isIndexing ? 'Indexing…' : 'Confirm'}
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
      </div>
    </div>
  );
}

