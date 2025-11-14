interface FolderItem {
    path: string;
    selected: boolean;
    fileCount?: number;
  }
  
  const folderListEl = document.getElementById('folder-list') as HTMLDivElement;
  const selectedCountEl = document.getElementById('selected-count') as HTMLSpanElement;
  const footerTextEl = document.getElementById('footer-text') as HTMLSpanElement;
  const statusBarEl = document.getElementById('status-bar') as HTMLDivElement;
  const statusLeftEl = document.getElementById('status-left') as HTMLDivElement;
  const statusRightEl = document.getElementById('status-right') as HTMLDivElement;
  
  const btnConnectFolder = document.getElementById('btn-connect-folder') as HTMLButtonElement;
  const btnSelectAll = document.getElementById('btn-select-all') as HTMLSpanElement;
  const btnClear = document.getElementById('btn-clear') as HTMLSpanElement;
  const btnConfirm = document.getElementById('btn-confirm') as HTMLButtonElement;
  const btnCancel = document.getElementById('btn-cancel') as HTMLButtonElement;
  
  let folders: FolderItem[] = [];
  
  function renderFolders() {
    folderListEl.innerHTML = '';
  
    if (folders.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'folder-empty';
      emptyDiv.textContent =
        'No folders connected yet. Click “Connect folder” to get started.';
      folderListEl.appendChild(emptyDiv);
    } else {
      folders.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'folder-item';
  
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'folder-checkbox';
        checkbox.checked = item.selected;
        checkbox.onchange = () => {
          item.selected = checkbox.checked;
          updateSelectionState();
        };
  
        const icon = document.createElement('div');
        icon.className = 'folder-icon';
  
        const pathSpan = document.createElement('div');
        pathSpan.className = 'folder-path';
        pathSpan.textContent = item.path;
  
        const countSpan = document.createElement('span');
        countSpan.className = 'folder-count';
        if (typeof item.fileCount === 'number') {
          countSpan.textContent = `${item.fileCount} files`;
        } else {
          countSpan.textContent = '';
        }
  
        row.appendChild(checkbox);
        row.appendChild(icon);
        row.appendChild(pathSpan);
        row.appendChild(countSpan);
  
        folderListEl.appendChild(row);
      });
    }
  
    updateSelectionState();
  }
  
  function updateSelectionState() {
    const selected = folders.filter(f => f.selected).length;
    selectedCountEl.textContent = `${selected} selected`;
    btnConfirm.disabled = selected === 0;
    if (folders.length === 0) {
      footerTextEl.textContent = 'Waiting for folders…';
    } else if (selected === 0) {
      footerTextEl.textContent = 'Select at least one folder to index.';
    } else {
      footerTextEl.textContent = 'Ready to index selected folders.';
    }
  }
  
  btnConnectFolder.onclick = async () => {
    const paths = await window.api.selectFolders();
    if (!paths || paths.length === 0) return;
  
    const existing = new Set(folders.map(f => f.path));
    for (const p of paths) {
      if (!existing.has(p)) {
        folders.push({ path: p, selected: true });
      }
    }
    // 清掉旧的计数
    folders.forEach(f => {
      f.fileCount = undefined;
    });
    statusBarEl.style.display = 'none';
    renderFolders();
  };
  
  btnSelectAll.onclick = () => {
    folders.forEach(f => (f.selected = true));
    renderFolders();
  };
  
  btnClear.onclick = () => {
    folders = [];
    statusBarEl.style.display = 'none';
    renderFolders();
  };
  
  btnCancel.onclick = () => {
    // 简单行为：重置选择与统计
    folders.forEach(f => {
      f.selected = true;
      f.fileCount = undefined;
    });
    statusBarEl.style.display = 'none';
    renderFolders();
  };
  
  btnConfirm.onclick = async () => {
    const selectedFolders = folders.filter(f => f.selected).map(f => f.path);
    if (selectedFolders.length === 0) return;
  
    footerTextEl.textContent = 'Indexing…';
    btnConfirm.disabled = true;
    statusBarEl.style.display = 'none';
  
    try {
      const res = await window.api.countFiles(selectedFolders);
      // 回填每个目录的文件数
      for (const item of res.perFolder) {
        const target = folders.find(f => f.path === item.folder);
        if (target) target.fileCount = item.count;
      }
      renderFolders();
  
      statusBarEl.style.display = 'flex';
      statusLeftEl.textContent = `Files to be connected: ${res.total} files.`;
      statusRightEl.textContent = `Indexed ${res.perFolder.length} folder(s).`;
      footerTextEl.textContent = 'Indexing summary ready.';
    } catch (err: any) {
      statusBarEl.style.display = 'flex';
      statusLeftEl.textContent = 'Failed to count files.';
      statusRightEl.textContent = String(err?.message ?? err);
      footerTextEl.textContent = 'Something went wrong.';
    } finally {
      btnConfirm.disabled = folders.filter(f => f.selected).length === 0;
    }
  };
  
  // 初始渲染
  renderFolders();