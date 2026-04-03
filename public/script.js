const state = {
  view: 'local',
  selectedFiles: new Set(),
  files: [],
  hasHfToken: false,
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
    console.error(error);
  }
}

function updateTokenStatus() {
  elements.hfTokenStatus.textContent = state.hasHfToken
    ? 'HF token is configured. You can use Hugging Face operations.'
    : 'No HF token configured yet. Set it here and save.';
}

async function saveConfig() {
  const body = {
    hfBucket: elements.hfBucketInput.value.trim(),
    hfToken: elements.hfTokenInput.value.trim(),
    clearToken: false,
  };
  try {
    await request('/api/config', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    state.hasHfToken = !!body.hfToken;
    updateTokenStatus();
    setStatus(elements.hfStatus, 'Configuration saved successfully.');
    elements.hfTokenInput.value = '';
  } catch (error) {
    setStatus(elements.hfStatus, 'Unable to save configuration.');
    console.error(error);
  }
}

async function clearToken() {
  try {
    await request('/api/config', {
      method: 'POST',
      body: JSON.stringify({ clearToken: true }),
    });
    state.hasHfToken = false;
    updateTokenStatus();
    setStatus(elements.hfStatus, 'HF token cleared.');
  } catch (error) {
    setStatus(elements.hfStatus, 'Unable to clear token.');
    console.error(error);
  }
}

function renderFiles() {
  const sorted = [...state.files];
  const sortKey = elements.sortBy.value;
  const direction = elements.sortOrder.value === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    if (sortKey === 'size') return (a.size - b.size) * direction;
    if (sortKey === 'date') return (new Date(a.updatedAt || a.uploadedAt || 0) - new Date(b.updatedAt || b.uploadedAt || 0)) * direction;
    return a.path.localeCompare(b.path) * direction;
  });

  if (sorted.length === 0) {
    elements.filesList.innerHTML = '<p>No files found.</p>';
    return;
  }

  elements.filesList.innerHTML = '';
  sorted.forEach((file) => {
    const item = document.createElement('div');
    item.className = 'file-item';

    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.selectedFiles.has(file.path);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.selectedFiles.add(file.path);
      else state.selectedFiles.delete(file.path);
    });

    const title = document.createElement('div');
    title.innerHTML = `<span class="file-name">${file.path}</span><div class="file-meta">${file.type || 'file'} • ${file.size || 0} bytes</div>`;

    label.appendChild(checkbox);
    label.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'file-actions';
    const download = document.createElement('button');
    download.className = 'btn btn-outline';
    download.textContent = 'Download';
    download.addEventListener('click', () => downloadFile(file.path));

    const remove = document.createElement('button');
    remove.className = 'btn btn-danger';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => deleteFiles([file.path]));

    actions.appendChild(download);
    actions.appendChild(remove);
    item.appendChild(label);
    item.appendChild(actions);

    elements.filesList.appendChild(item);
  });
}

async function loadFiles(view = 'local') {
  state.view = view;
  state.selectedFiles.clear();
  setStatus(elements.hfStatus, `Loading ${view} files...`);
  try {
    const endpoint = view === 'local' ? '/api/files' : '/api/hf/files';
    state.files = await request(endpoint);
    renderFiles();
    setStatus(elements.hfStatus, `${view === 'local' ? 'Local' : 'HF'} files loaded.`);
  } catch (error) {
    setStatus(elements.hfStatus, `Unable to load ${view} files.`);
    elements.filesList.innerHTML = '<p>Error loading files.</p>';
    console.error(error);
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
    if (!res.ok) throw new Error(await res.text());
    setStatus(elements.uploadStatus, 'Upload completed successfully.');
    await loadFiles(state.view);
  } catch (error) {
    setStatus(elements.uploadStatus, 'Upload failed.');
    console.error(error);
  }
}

async function uploadSingle(file) {
  const form = new FormData();
  form.append('file', file);
  const target = getUploadTarget();
  const url = target === 'hf' ? '/api/hf/upload' : '/api/upload';
  try {
    const res = await fetch(url, { method: 'POST', body: form });
    if (!res.ok) throw new Error(await res.text());
    setStatus(elements.uploadStatus, 'Upload completed successfully.');
    await loadFiles(state.view);
  } catch (error) {
    setStatus(elements.uploadStatus, 'Upload failed.');
    console.error(error);
  }
}

async function deleteFiles(paths) {
  try {
    const target = state.view === 'hf' ? 'hf' : 'local';
    const url = target === 'hf' ? '/api/hf/delete-multiple' : '/api/delete-multiple';
    const method = 'POST';
    await request(url, { method, body: JSON.stringify({ filenames: paths }) });
    setStatus(elements.hfStatus, 'Delete successful.');
    await loadFiles(state.view);
  } catch (error) {
    setStatus(elements.hfStatus, 'Delete failed.');
    console.error(error);
  }
}

async function downloadFile(path) {
  const target = state.view === 'hf' ? 'hf' : 'local';
  const url = target === 'hf' ? `/api/hf/download/${encodeURIComponent(path)}` : `/api/download/${encodeURIComponent(path)}`;
  window.open(url, '_blank');
}

function handleFileSelection() {
  const files = Array.from(elements.fileInput.files || []);
  if (files.length === 0) {
    setStatus(elements.uploadStatus, 'No file selected.');
    return;
  }
  uploadSingle(files[0]);
}

function handleFolderSelection() {
  const files = Array.from(elements.folderInput.files || []);
  if (files.length === 0) {
    setStatus(elements.uploadStatus, 'No files selected.');
    return;
  }
  const paths = files.map((file) => file.webkitRelativePath || file.name);
  uploadFiles(files, paths);
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
    const folderPath = prompt('Enter folder path to create');
    if (!folderPath) return;
    try {
      const url = state.view === 'hf' ? '/api/hf/create-folder' : '/api/create-folder';
      await request(url, { method: 'POST', body: JSON.stringify({ folderPath }) });
      setStatus(elements.hfStatus, 'Folder created successfully.');
      await loadFiles(state.view);
    } catch (error) {
      setStatus(elements.hfStatus, 'Unable to create folder.');
      console.error(error);
    }
  });

  elements.deleteSelectedBtn.addEventListener('click', async () => {
    if (state.selectedFiles.size === 0) {
      setStatus(elements.hfStatus, 'No files selected to delete.');
      return;
    }
    if (!confirm('Delete selected files?')) return;
    await deleteFiles(Array.from(state.selectedFiles));
  });

  elements.moveSelectedBtn.addEventListener('click', async () => {
    if (state.selectedFiles.size === 0) {
      setStatus(elements.hfStatus, 'No files selected to move.');
      return;
    }
    const destination = prompt('Enter destination folder path:');
    if (!destination) return;
    try {
      const url = state.view === 'hf' ? '/api/hf/move' : '/api/move';
      await request(url, {
        method: 'POST',
        body: JSON.stringify({ files: Array.from(state.selectedFiles), destination }),
      });
      setStatus(elements.hfStatus, 'Files moved successfully.');
      await loadFiles(state.view);
    } catch (error) {
      setStatus(elements.hfStatus, 'Unable to move files.');
      console.error(error);
    }
  });

  elements.clearSelectionBtn.addEventListener('click', () => {
    state.selectedFiles.clear();
    renderFiles();
  });

  elements.selectAll.addEventListener('change', () => {
    if (elements.selectAll.checked) {
      state.files.forEach((file) => state.selectedFiles.add(file.path));
    } else {
      state.selectedFiles.clear();
    }
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
