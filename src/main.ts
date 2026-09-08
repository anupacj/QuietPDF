import './styles/style.css';
import { mergePdfs } from './tools/merge';
import { compressPdf } from './tools/compress';

// Global Notifications & Badges
const errorBox = document.getElementById('error-box') as HTMLDivElement;
const successBox = document.getElementById('success-box') as HTMLDivElement;
const activeToolBadge = document.getElementById('active-tool-badge') as HTMLElement;

// Tab Navigation
const tabMerge = document.getElementById('tab-merge') as HTMLButtonElement;
const tabCompress = document.getElementById('tab-compress') as HTMLButtonElement;
const viewMerge = document.getElementById('view-merge') as HTMLElement;
const viewCompress = document.getElementById('view-compress') as HTMLElement;

function switchTool(tool: 'merge' | 'compress'): void {
  clearMessages();
  if (tool === 'merge') {
    tabMerge.classList.add('active');
    tabCompress.classList.remove('active');
    viewMerge.hidden = false;
    viewCompress.hidden = true;
    activeToolBadge.textContent = 'Merge';
  } else {
    tabCompress.classList.add('active');
    tabMerge.classList.remove('active');
    viewCompress.hidden = false;
    viewMerge.hidden = true;
    activeToolBadge.textContent = 'Compress';
  }
}

tabMerge.addEventListener('click', () => switchTool('merge'));
tabCompress.addEventListener('click', () => switchTool('compress'));

// Helper: Format file size
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Notifications
function showError(message: string): void {
  errorBox.textContent = message;
  errorBox.hidden = false;
  successBox.hidden = true;
}

function showSuccess(message: string): void {
  successBox.textContent = message;
  successBox.hidden = false;
  errorBox.hidden = true;
}

function clearMessages(): void {
  errorBox.hidden = true;
  errorBox.textContent = '';
  successBox.hidden = true;
  successBox.textContent = '';
}

// Helper: Download a Uint8Array as file
function triggerDownload(data: Uint8Array, fileName: string): void {
  const blob = new Blob([data as unknown as BlobPart], { type: 'application/pdf' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

/* =========================================================
   MERGE TOOL
   ========================================================= */
let filesToMerge: File[] = [];

const dropzone = document.getElementById('dropzone') as HTMLDivElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const addMoreInput = document.getElementById('add-more-input') as HTMLInputElement;
const fileSection = document.getElementById('file-section') as HTMLElement;
const fileList = document.getElementById('file-list') as HTMLUListElement;
const fileCount = document.getElementById('file-count') as HTMLElement;
const clearAllBtn = document.getElementById('clear-all-btn') as HTMLButtonElement;
const mergeBtn = document.getElementById('merge-btn') as HTMLButtonElement;

function renderMergeList(): void {
  fileList.innerHTML = '';
  const total = filesToMerge.length;

  if (total === 0) {
    fileSection.hidden = true;
    mergeBtn.disabled = true;
    return;
  }

  fileSection.hidden = false;
  fileCount.textContent = `Selected Files (${total})`;
  mergeBtn.disabled = total < 2;

  filesToMerge.forEach((file, index) => {
    const li = document.createElement('li');
    li.className = 'file-item';

    const badge = document.createElement('span');
    badge.className = 'file-index';
    badge.textContent = String(index + 1);

    const details = document.createElement('div');
    details.className = 'file-details';

    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = file.name;
    name.title = file.name;

    const size = document.createElement('span');
    size.className = 'file-size';
    size.textContent = formatBytes(file.size);

    details.appendChild(name);
    details.appendChild(size);

    const controls = document.createElement('div');
    controls.className = 'file-controls';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'btn-icon';
    upBtn.title = 'Move up';
    upBtn.innerHTML = '&#8593;';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', () => moveMergeFile(index, -1));

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'btn-icon';
    downBtn.title = 'Move down';
    downBtn.innerHTML = '&#8595;';
    downBtn.disabled = index === total - 1;
    downBtn.addEventListener('click', () => moveMergeFile(index, 1));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-icon btn-delete';
    deleteBtn.title = 'Remove file';
    deleteBtn.innerHTML = '&#10005;';
    deleteBtn.addEventListener('click', () => removeMergeFile(index));

    controls.appendChild(upBtn);
    controls.appendChild(downBtn);
    controls.appendChild(deleteBtn);

    li.appendChild(badge);
    li.appendChild(details);
    li.appendChild(controls);

    fileList.appendChild(li);
  });
}

function handleMergeFiles(files: FileList | null): void {
  if (!files || files.length === 0) return;

  clearMessages();
  let nonPdfFound = false;

  Array.from(files).forEach((file) => {
    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      filesToMerge.push(file);
    } else {
      nonPdfFound = true;
    }
  });

  if (nonPdfFound) {
    showError('Some selected files were skipped because they are not valid PDF files.');
  }

  renderMergeList();
}

function moveMergeFile(fromIndex: number, direction: number): void {
  const toIndex = fromIndex + direction;
  if (toIndex < 0 || toIndex >= filesToMerge.length) return;

  const [moved] = filesToMerge.splice(fromIndex, 1);
  filesToMerge.splice(toIndex, 0, moved);
  renderMergeList();
}

function removeMergeFile(index: number): void {
  filesToMerge.splice(index, 1);
  renderMergeList();
}

clearAllBtn.addEventListener('click', () => {
  filesToMerge = [];
  fileInput.value = '';
  addMoreInput.value = '';
  clearMessages();
  renderMergeList();
});

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener('change', () => {
  handleMergeFiles(fileInput.files);
  fileInput.value = '';
});

addMoreInput.addEventListener('change', () => {
  handleMergeFiles(addMoreInput.files);
  addMoreInput.value = '';
});

['dragenter', 'dragover'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add('drag-active');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('drag-active');
  });
});

dropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer && e.dataTransfer.files) {
    handleMergeFiles(e.dataTransfer.files);
  }
});

mergeBtn.addEventListener('click', async () => {
  if (filesToMerge.length < 2) {
    showError('Please select at least 2 PDF files to merge.');
    return;
  }

  clearMessages();
  const originalHtml = mergeBtn.innerHTML;
  mergeBtn.disabled = true;
  mergeBtn.innerHTML = '<span class="spinner"></span> <span>Merging PDFs...</span>';

  try {
    const mergedBytes = await mergePdfs(filesToMerge);
    triggerDownload(mergedBytes, 'merged.pdf');
    showSuccess(`Successfully merged ${filesToMerge.length} PDFs! Your download has started.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred while merging.';
    showError(message);
  } finally {
    mergeBtn.innerHTML = originalHtml;
    mergeBtn.disabled = filesToMerge.length < 2;
  }
});

/* =========================================================
   COMPRESS TOOL
   ========================================================= */
let fileToCompress: File | null = null;
let lastCompressedBytes: Uint8Array | null = null;
let lastDownloadName: string = 'compressed.pdf';

const compressDropzone = document.getElementById('compress-dropzone') as HTMLDivElement;
const compressFileInput = document.getElementById('compress-file-input') as HTMLInputElement;
const compressFileCard = document.getElementById('compress-file-card') as HTMLDivElement;
const compressFileName = document.getElementById('compress-file-name') as HTMLElement;
const compressFileSize = document.getElementById('compress-file-size') as HTMLElement;
const compressRemoveFile = document.getElementById('compress-remove-file') as HTMLButtonElement;
const compressBtn = document.getElementById('compress-btn') as HTMLButtonElement;
const compressResults = document.getElementById('compress-results') as HTMLDivElement;
const resOriginalSize = document.getElementById('res-original-size') as HTMLElement;
const resCompressedSize = document.getElementById('res-compressed-size') as HTMLElement;
const resReductionBadge = document.getElementById('res-reduction-badge') as HTMLElement;
const downloadAgainBtn = document.getElementById('download-again-btn') as HTMLButtonElement;

// Quality selector radio options
const levelLabels = document.querySelectorAll('.level-option');
levelLabels.forEach((label) => {
  const radio = label.querySelector('input[type="radio"]') as HTMLInputElement;
  radio.addEventListener('change', () => {
    levelLabels.forEach((l) => l.classList.remove('selected'));
    if (radio.checked) {
      label.classList.add('selected');
    }
  });
});

function getSelectedQuality(): number {
  const checked = document.querySelector('input[name="compression-level"]:checked') as HTMLInputElement;
  return checked ? parseFloat(checked.value) : 0.6;
}

function handleCompressFile(files: FileList | null): void {
  if (!files || files.length === 0) return;

  clearMessages();
  compressResults.hidden = true;

  const file = files[0];
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (!isPdf) {
    showError(`"${file.name}" is not a valid PDF file. Please select a .pdf file.`);
    return;
  }

  fileToCompress = file;
  compressFileName.textContent = file.name;
  compressFileSize.textContent = formatBytes(file.size);

  compressDropzone.hidden = true;
  compressFileCard.hidden = false;
  compressBtn.disabled = false;
}

function clearCompressFile(): void {
  fileToCompress = null;
  lastCompressedBytes = null;
  compressFileInput.value = '';
  compressDropzone.hidden = false;
  compressFileCard.hidden = true;
  compressBtn.disabled = true;
  compressResults.hidden = true;
  clearMessages();
}

compressRemoveFile.addEventListener('click', clearCompressFile);

compressDropzone.addEventListener('click', () => compressFileInput.click());
compressDropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    compressFileInput.click();
  }
});

compressFileInput.addEventListener('change', () => {
  handleCompressFile(compressFileInput.files);
});

['dragenter', 'dragover'].forEach((eventName) => {
  compressDropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    compressDropzone.classList.add('drag-active');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  compressDropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    compressDropzone.classList.remove('drag-active');
  });
});

compressDropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer && e.dataTransfer.files) {
    handleCompressFile(e.dataTransfer.files);
  }
});

// Compress action
compressBtn.addEventListener('click', async () => {
  if (!fileToCompress) {
    showError('Please select a PDF file to compress.');
    return;
  }

  clearMessages();
  compressResults.hidden = true;

  const originalHtml = compressBtn.innerHTML;
  compressBtn.disabled = true;
  compressBtn.innerHTML = '<span class="spinner"></span> <span>Compressing PDF...</span>';

  try {
    const quality = getSelectedQuality();
    const compressedBytes = await compressPdf(fileToCompress, quality);

    const originalSize = fileToCompress.size;
    const newSize = compressedBytes.length;
    const diff = originalSize - newSize;
    const percent = Math.round((diff / originalSize) * 100);

    lastCompressedBytes = compressedBytes;
    const baseName = fileToCompress.name.replace(/\.pdf$/i, '');
    lastDownloadName = `${baseName}-compressed.pdf`;

    // Update results summary UI
    resOriginalSize.textContent = formatBytes(originalSize);
    resCompressedSize.textContent = formatBytes(newSize);

    if (diff > 0 && percent > 0) {
      resReductionBadge.textContent = `-${percent}% reduction (saved ${formatBytes(diff)})`;
    } else {
      resReductionBadge.textContent = 'Already optimally compressed';
    }

    compressResults.hidden = false;

    // Trigger download
    triggerDownload(compressedBytes, lastDownloadName);
    showSuccess(`PDF compressed successfully! Your download has started.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An error occurred while compressing the PDF.';
    showError(message);
  } finally {
    compressBtn.innerHTML = originalHtml;
    compressBtn.disabled = !fileToCompress;
  }
});

downloadAgainBtn.addEventListener('click', () => {
  if (lastCompressedBytes) {
    triggerDownload(lastCompressedBytes, lastDownloadName);
  }
});
