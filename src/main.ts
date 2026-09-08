import './styles/style.css';
import { mergePdfs } from './tools/merge';

// State
let filesToMerge: File[] = [];

// DOM Elements
const dropzone = document.getElementById('dropzone') as HTMLDivElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const addMoreInput = document.getElementById('add-more-input') as HTMLInputElement;
const fileSection = document.getElementById('file-section') as HTMLElement;
const fileList = document.getElementById('file-list') as HTMLUListElement;
const fileCount = document.getElementById('file-count') as HTMLElement;
const clearAllBtn = document.getElementById('clear-all-btn') as HTMLButtonElement;
const mergeBtn = document.getElementById('merge-btn') as HTMLButtonElement;
const errorBox = document.getElementById('error-box') as HTMLDivElement;
const successBox = document.getElementById('success-box') as HTMLDivElement;

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

// Render selected file list
function render(): void {
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

    // Index badge
    const badge = document.createElement('span');
    badge.className = 'file-index';
    badge.textContent = String(index + 1);

    // File details
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

    // Controls
    const controls = document.createElement('div');
    controls.className = 'file-controls';

    // Move Up
    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'btn-icon';
    upBtn.title = 'Move up';
    upBtn.innerHTML = '&#8593;';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', () => moveFile(index, -1));

    // Move Down
    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'btn-icon';
    downBtn.title = 'Move down';
    downBtn.innerHTML = '&#8595;';
    downBtn.disabled = index === total - 1;
    downBtn.addEventListener('click', () => moveFile(index, 1));

    // Delete
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-icon btn-delete';
    deleteBtn.title = 'Remove file';
    deleteBtn.innerHTML = '&#10005;';
    deleteBtn.addEventListener('click', () => removeFile(index));

    controls.appendChild(upBtn);
    controls.appendChild(downBtn);
    controls.appendChild(deleteBtn);

    li.appendChild(badge);
    li.appendChild(details);
    li.appendChild(controls);

    fileList.appendChild(li);
  });
}

// Add files with validation
function handleFiles(files: FileList | null): void {
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

  render();
}

// Reorder files
function moveFile(fromIndex: number, direction: number): void {
  const toIndex = fromIndex + direction;
  if (toIndex < 0 || toIndex >= filesToMerge.length) return;

  const [moved] = filesToMerge.splice(fromIndex, 1);
  filesToMerge.splice(toIndex, 0, moved);
  render();
}

// Remove single file
function removeFile(index: number): void {
  filesToMerge.splice(index, 1);
  render();
}

// Clear all files
clearAllBtn.addEventListener('click', () => {
  filesToMerge = [];
  fileInput.value = '';
  addMoreInput.value = '';
  clearMessages();
  render();
});

// File picker inputs
dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener('change', () => {
  handleFiles(fileInput.files);
  fileInput.value = '';
});

addMoreInput.addEventListener('change', () => {
  handleFiles(addMoreInput.files);
  addMoreInput.value = '';
});

// Drag and drop handlers
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
    handleFiles(e.dataTransfer.files);
  }
});

// Merge action
mergeBtn.addEventListener('click', async () => {
  if (filesToMerge.length < 2) {
    showError('Please select at least 2 PDF files to merge.');
    return;
  }

  clearMessages();

  // Button loading state
  const originalHtml = mergeBtn.innerHTML;
  mergeBtn.disabled = true;
  mergeBtn.innerHTML = '<span class="spinner"></span> <span>Merging PDFs...</span>';

  try {
    const mergedBytes = await mergePdfs(filesToMerge);

    // Download merged file
    const blob = new Blob([mergedBytes as unknown as BlobPart], { type: 'application/pdf' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'merged.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up object URL after a short delay
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

    showSuccess(`Successfully merged ${filesToMerge.length} PDFs! Your download has started.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred while merging.';
    showError(message);
  } finally {
    mergeBtn.innerHTML = originalHtml;
    mergeBtn.disabled = filesToMerge.length < 2;
  }
});
