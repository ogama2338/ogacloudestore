const state = {
  view: 'local',
  selectedFiles: new Set(),
  files: [],
  hasHfToken: false,
  currentPath: '',
};

const elements = {
  uploadArea: document.getElementById('uploadArea'),
  fileInput: document.getElementById('fileInput'),
  folderInput: document.getElementById('folderInput'),
  uploadBtn: document.getElementById('uploadBtn'),
  uploadFolderBtn: document.getElementById('uploadFolderBtn'),
  loadHfBtn: document.getElementById('loadHfBtn'),
  saveConfigBtn: document.getElementById('saveConfigBtn'),
  clearTokenBtn: document.getElementById('clearTokenBtn'),
  hfBucketInput: document.getElementById('hfBucketInput'),
  hfTokenInput: document.getElementById('hfTokenInput'),
  hfTokenStatus: document.getElementById('hfTokenStatus'),
  hfStatus: document.getElementById('hfStatus'),
  filesList: document.getElementById('filesList'),
  showLocalBtn: document.getElementById('showLocalBtn'),
  showHfBtn: document.getElementById('showHfBtn'),
  createFolderBtn: document.getElementById('createFolderBtn'),
  moveSelectedBtn: document.getElementById('moveSelectedBtn'),
  deleteSelectedBtn: document.getElementById('deleteSelectedBtn'),
  clearSelectionBtn: document.getElementById('clearSelectionBtn'),
  selectAll: document.getElementById('selectAll'),
  sortBy: document.getElementById('sortBy'),
  sortOrder: document.getElementById('sortOrder'),
  uploadTarget: document.querySelectorAll('input[name="uploadTarget"]'),
  uploadStatus: document.getElementById('uploadStatus'),
};

function setStatus(el, text) {
  el.textContent = text;
}

function getUploadTarget() {
  return Array.from(elements.uploadTarget).find((input) => input.checked)?.value || 'local';
}

async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || res.statusText);
  }
  return res.json();
}

async function loadConfig() {
  try {
    const data = await request('/api/config');
    elements.hfBucketInput.value = data.hfBucket || '';
    state.hasHfToken = data.hasHfToken;
    updateTokenStatus();
    setStatus(elements.hfStatus, 'Configuration loaded.');
  } catch (error) {
    setStatus(elements.hfStatus, 'Unable to load configuration.');
  }
}

function updateTokenStatus() {
  elements.hfTokenStatus.textContent = state.hasHfToken
    ? 'HF token is configured.'
    : 'No HF token configured yet.';
}

async function saveConfig() {
  const body = {
    hfBucket: elements.hfBucketInput.value.trim(),
    hfToken: elements.hfTokenInput.value.trim(),
    clearToken: false,
  };
  try {
    await request('/api/config', { method: 'POST', body: JSON.stringify(body) });
    state.hasHfToken = !!body.hfToken;
    updateTokenStatus();
    setStatus(elements.hfStatus, 'Config saved.');
    elements.hfTokenInput.value = '';
  } catch (error) {
    setStatus(elements.hfStatus, 'Save failed.');
  }
}

async function clearToken() {
  try {
    await request('/api/config', { method: 'POST', body: JSON.stringify({ clearToken: true }) });
    state.hasHfToken = false;
    updateTokenStatus();
    setStatus(elements.hfStatus, 'Token cleared.');
  } catch (error) {
    setStatus(elements.hfStatus, 'Clear failed.');
  }
}

function renderFiles() {
  const sortKey = elements.sortBy.value;
  const direction = elements.sortOrder.value === 'asc' ? 1 : -1;

  // 1. Filter for Current Folder
  const visibleFiles = state.files.filter(file => {
    const parts = file.path.split('/');
    if (state.currentPath === '') return parts.length === 1;
    const parentPath = parts.slice(0, -1).join('/');
    return parentPath === state.currentPath;
  });

  // 2. Sort: Folders first, then by user choice
  visibleFiles.sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    if (sortKey === 'size') return (a.size - b.size) * direction;
    return a.path.localeCompare(b.path) * direction;
  });

  elements.filesList.innerHTML = '';

  // Add Back Button
  if (state.currentPath !== '') {
    const backItem = document.createElement('div');
    backItem.className = 'file-item';
    backItem.innerHTML = `<button class="btn btn-secondary">⬅ Back to Parent</button>`;
    backItem.onclick = () => {
      const parts = state.currentPath.split('/');
      parts.pop();
      state.currentPath = parts.join('/');
      renderFiles();
    };
    elements.filesList.appendChild(backItem);
  }

  if (visibleFiles.length === 0) {
    elements.filesList.innerHTML += '<p style="padding:20px;">Folder is empty.</p>';
    return;
  }

  visibleFiles.forEach((file) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    const fileName = file.path.split('/').pop();

    const label = document.createElement('label');
    label.innerHTML = `
      <input type="checkbox" ${state.selectedFiles.has(file.path) ? 'checked' : ''}>
      <div>
        <span class="file-name">${file.type === 'directory' ? '📁' : '📄'} ${fileName}</span>
        <div class="file-meta">${file.size || 0} bytes • ${file.type}</div>
      </div>
    `;

    label.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) state.selectedFiles.add(file.path);
      else state.selectedFiles.delete(file.path);
    });

    const actions = document.createElement('div');
    actions.className = 'file-actions';

    // OPEN (Folder) or DOWNLOAD (File)
    if (file.type === 'directory') {
      const btn = document.createElement('button');
      btn.className = 'btn btn-info';
      btn.textContent = 'Open';
      btn.onclick = () => { state.currentPath = file.path; renderFiles(); };
      actions.appendChild(btn);
    } else {
      const btn = document.createElement('button');
      btn.className = 'btn btn-outline';
      btn.textContent = 'Download';
      btn.onclick = () => downloadFile(file.path);
      actions.appendChild(btn);
    }

    // RENAME
    const renBtn = document.createElement('button');
    renBtn.className = 'btn btn-warning';
    renBtn.textContent = 'Rename';
    renBtn.onclick = async () => {
      const newName = prompt('Enter new name:', fileName);
      if (!newName || newName === fileName) return;
      const newPath = state.currentPath ? `${state.currentPath}/${newName}` : newName;
      try {
        const url = state.view === 'hf' ? '/api/hf/rename' : '/api/rename';
        await request(url, { method: 'POST', body: JSON.stringify({ oldPath: file.path, newPath }) });
        loadFiles(state.view);
      } catch (e) { alert('Rename failed'); }
    };
    actions.appendChild(renBtn);

    // DELETE
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger';
    delBtn.textContent = 'Delete';
    delBtn.onclick = () => { if(confirm(`Delete ${fileName}?`)) deleteFiles([file.path]); };
    actions.appendChild(delBtn);

    item.appendChild(label);
    item.appendChild(actions);
    elements.filesList.appendChild(item);
  });
}

async function loadFiles(view = 'local') {
  state.view = view;
  state.currentPath = ''; // Start at root when switching
  state.selectedFiles.clear();
  elements.selectAll.checked = false;
  setStatus(elements.hfStatus, `Loading ${view}...`);
  try {
    const endpoint = view === 'local' ? '/api/files' : '/api/hf/files';
    state.files = await request(endpoint);
    renderFiles();
    setStatus(elements.hfStatus, `${view} loaded.`);
  } catch (error) {
    setStatus(elements.hfStatus, `Error loading ${view}.`);
  }
}

async function uploadFiles(files, paths = []) {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  paths.forEach((path) => form.append('paths', path));
  const target = getUploadTarget();
  const url = target === 'hf' ? '/api/hf/upload-multiple' : '/api/upload-multiple';
  try {
    const res = await fetch(url, { method: 'POST', body: form });
    if (!res.ok) throw new Error();
    setStatus(elements.uploadStatus, 'Upload success.');
    loadFiles(state.view);
  } catch (error) { setStatus(elements.uploadStatus, 'Upload failed.'); }
}

async function uploadSingle(file) {
  const target = getUploadTarget();
  setStatus(elements.uploadStatus, 'Starting upload...');

  if (target === 'hf') {
    // DIRECT BROWSER UPLOAD (Handles 100MB+ via LFS)
    try {
      // 1. Get your keys from your server
      const { token, bucket } = await request('/api/hf/credentials');
      
      setStatus(elements.uploadStatus, `Uploading ${file.name} (Direct to HF)...`);

      // 2. Use the HF Hub library (global variable 'huggingfaceHub')
      // Note: We use the 'buckets/' prefix because your backend uses it
      await huggingfaceHub.uploadFiles({
        repo: `buckets/${bucket}`, 
        accessToken: token,
        files: [
          {
            path: file.name,
            content: file,
          },
        ],
      });

      setStatus(elements.uploadStatus, 'Upload success (Direct LFS)!');
      loadFiles('hf');
    } catch (error) {
      console.error("HF Upload Error:", error);
      setStatus(elements.uploadStatus, 'HF Upload Failed. Check console for details.');
    }
  } else {
    // LOCAL UPLOAD (Still limited to 4.5MB by Vercel)
    if (file.size > 4.5 * 1024 * 1024) {
        alert("Local uploads on Vercel are limited to 4.5MB. Use HF Bucket for large files.");
        return;
    }
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error();
      setStatus(elements.uploadStatus, 'Local upload success.');
      loadFiles('local');
    } catch (error) {
      setStatus(elements.uploadStatus, 'Local upload failed.');
    }
  }
}
async function deleteFiles(paths) {
  try {
    const url = state.view === 'hf' ? '/api/hf/delete-multiple' : '/api/delete-multiple';
    await request(url, { method: 'POST', body: JSON.stringify({ filenames: paths }) });
    loadFiles(state.view);
  } catch (error) { alert('Delete failed'); }
}

async function downloadFile(path) {
  const target = state.view === 'hf' ? 'hf' : 'local';
  const url = target === 'hf' ? `/api/hf/download/${encodeURIComponent(path)}` : `/api/download/${encodeURIComponent(path)}`;
  window.open(url, '_blank');
}

function handleFileSelection() {
  const files = Array.from(elements.fileInput.files || []);
  if (files.length > 0) uploadSingle(files[0]);
}

function handleFolderSelection() {
  const files = Array.from(elements.folderInput.files || []);
  if (files.length > 0) {
    const paths = files.map((file) => file.webkitRelativePath || file.name);
    uploadFiles(files, paths);
  }
}

function bindEvents() {
  elements.uploadArea.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', handleFileSelection);
  elements.folderInput.addEventListener('change', handleFolderSelection);
  elements.uploadBtn.addEventListener('click', () => elements.fileInput.click());
  elements.uploadFolderBtn.addEventListener('click', () => elements.folderInput.click());
  elements.loadHfBtn.addEventListener('click', () => loadFiles('hf'));
  elements.saveConfigBtn.addEventListener('click', saveConfig);
  elements.clearTokenBtn.addEventListener('click', clearToken);
  elements.showLocalBtn.addEventListener('click', () => loadFiles('local'));
  elements.showHfBtn.addEventListener('click', () => loadFiles('hf'));
  
  elements.createFolderBtn.addEventListener('click', async () => {
    const name = prompt('Folder name:');
    if (!name) return;
    const folderPath = state.currentPath ? `${state.currentPath}/${name}` : name;
    try {
      const url = state.view === 'hf' ? '/api/hf/create-folder' : '/api/create-folder';
      await request(url, { method: 'POST', body: JSON.stringify({ folderPath }) });
      loadFiles(state.view);
    } catch (e) { alert('Failed to create folder'); }
  });

  elements.deleteSelectedBtn.addEventListener('click', () => {
    if (state.selectedFiles.size === 0) return;
    if (confirm('Delete selected?')) deleteFiles(Array.from(state.selectedFiles));
  });

  elements.moveSelectedBtn.addEventListener('click', async () => {
    if (state.selectedFiles.size === 0) return;
    const destination = prompt('Move to folder path:');
    if (!destination) return;
    try {
      const url = state.view === 'hf' ? '/api/hf/move' : '/api/move';
      await request(url, { method: 'POST', body: JSON.stringify({ files: Array.from(state.selectedFiles), destination }) });
      loadFiles(state.view);
    } catch (e) { alert('Move failed'); }
  });

  elements.clearSelectionBtn.addEventListener('click', () => {
    state.selectedFiles.clear();
    renderFiles();
  });

  elements.selectAll.addEventListener('change', () => {
    if (elements.selectAll.checked) state.files.forEach(f => state.selectedFiles.add(f.path));
    else state.selectedFiles.clear();
    renderFiles();
  });

  elements.sortBy.addEventListener('change', renderFiles);
  elements.sortOrder.addEventListener('change', renderFiles);
}

function init() {
  bindEvents();
  loadConfig();
  loadFiles('local');
}

window.addEventListener('DOMContentLoaded', init);
