import './styles/style.css';
import { mergePdfs } from './tools/merge';
import { compressPdf } from './tools/compress';
import { imagesToPdf } from './tools/imageToPdf';
import { pdfToImages } from './tools/pdfToImage';

// Global Notifications
const errorBox = document.getElementById('error-box') as HTMLDivElement;
const successBox = document.getElementById('success-box') as HTMLDivElement;

// Helpers: Format file size
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

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

// Download helper for Uint8Array or Blob
function triggerDownload(data: Uint8Array | Blob, fileName: string, mimeType = 'application/pdf'): void {
  const blob = data instanceof Blob ? data : new Blob([data as unknown as BlobPart], { type: mimeType });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

// Tab Navigation
type ToolId = 'merge' | 'compress' | 'image-to-pdf' | 'pdf-to-image';

const tabs: Record<ToolId, { tab: HTMLButtonElement; view: HTMLElement }> = {
  merge: {
    tab: document.getElementById('tab-merge') as HTMLButtonElement,
    view: document.getElementById('view-merge') as HTMLElement,
  },
  compress: {
    tab: document.getElementById('tab-compress') as HTMLButtonElement,
    view: document.getElementById('view-compress') as HTMLElement,
  },
  'image-to-pdf': {
    tab: document.getElementById('tab-image-to-pdf') as HTMLButtonElement,
    view: document.getElementById('view-image-to-pdf') as HTMLElement,
  },
  'pdf-to-image': {
    tab: document.getElementById('tab-pdf-to-image') as HTMLButtonElement,
    view: document.getElementById('view-pdf-to-image') as HTMLElement,
  },
};

function switchTool(selected: ToolId): void {
  clearMessages();
  (Object.keys(tabs) as ToolId[]).forEach((id) => {
    const isMatch = id === selected;
    tabs[id].tab.classList.toggle('active', isMatch);
    tabs[id].view.hidden = !isMatch;
  });
}

(Object.keys(tabs) as ToolId[]).forEach((id) => {
  tabs[id].tab.addEventListener('click', () => switchTool(id));
});

/* =========================================================
   1. MERGE TOOL
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
  fileCount.textContent = `Selected files (${total})`;
  mergeBtn.disabled = total < 2;

  filesToMerge.forEach((file, index) => {
    const li = document.createElement('li');
    li.className = 'file-item';

    const badge = document.createElement('span');
    badge.className = 'file-index';
    badge.textContent = `${index + 1}.`;

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
    upBtn.className = 'btn-control';
    upBtn.title = 'Move up';
    upBtn.innerHTML = '&#8593;';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', () => moveMergeFile(index, -1));

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'btn-control';
    downBtn.title = 'Move down';
    downBtn.innerHTML = '&#8595;';
    downBtn.disabled = index === total - 1;
    downBtn.addEventListener('click', () => moveMergeFile(index, 1));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-control btn-delete';
    deleteBtn.title = 'Remove';
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
    showError('One or more selected files were skipped because they are not valid PDF documents.');
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
    showError('Please select at least two PDF files to merge.');
    return;
  }

  clearMessages();
  const originalHtml = mergeBtn.innerHTML;
  mergeBtn.disabled = true;
  mergeBtn.innerHTML = '<span class="spinner"></span> <span>Merging files...</span>';

  try {
    const mergedBytes = await mergePdfs(filesToMerge);
    triggerDownload(mergedBytes, 'merged.pdf');
    showSuccess('Files merged successfully. Download started.');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An error occurred while merging files.';
    showError(message);
  } finally {
    mergeBtn.innerHTML = originalHtml;
    mergeBtn.disabled = filesToMerge.length < 2;
  }
});

/* =========================================================
   2. COMPRESS TOOL
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

// Compression Level Radio Selection
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

compressBtn.addEventListener('click', async () => {
  if (!fileToCompress) {
    showError('Please select a PDF file to compress.');
    return;
  }

  clearMessages();
  compressResults.hidden = true;

  const originalHtml = compressBtn.innerHTML;
  compressBtn.disabled = true;
  compressBtn.innerHTML = '<span class="spinner"></span> <span>Compressing file...</span>';

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

    resOriginalSize.textContent = formatBytes(originalSize);
    resCompressedSize.textContent = formatBytes(newSize);

    if (diff > 0 && percent > 0) {
      resReductionBadge.textContent = `-${percent}% (${formatBytes(diff)} saved)`;
    } else {
      resReductionBadge.textContent = 'Optimal size already achieved';
    }

    compressResults.hidden = false;
    triggerDownload(compressedBytes, lastDownloadName);
    showSuccess('PDF compressed successfully. Download started.');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An error occurred while compressing the file.';
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

/* =========================================================
   3. IMAGE TO PDF TOOL
   ========================================================= */
let imagesToConvert: File[] = [];

const img2pdfDropzone = document.getElementById('img2pdf-dropzone') as HTMLDivElement;
const img2pdfFileInput = document.getElementById('img2pdf-file-input') as HTMLInputElement;
const img2pdfAddMoreInput = document.getElementById('img2pdf-add-more-input') as HTMLInputElement;
const img2pdfFileSection = document.getElementById('img2pdf-file-section') as HTMLElement;
const img2pdfFileList = document.getElementById('img2pdf-file-list') as HTMLUListElement;
const img2pdfFileCount = document.getElementById('img2pdf-file-count') as HTMLElement;
const img2pdfClearAllBtn = document.getElementById('img2pdf-clear-all-btn') as HTMLButtonElement;
const img2pdfBtn = document.getElementById('img2pdf-btn') as HTMLButtonElement;

function renderImg2PdfList(): void {
  img2pdfFileList.innerHTML = '';
  const total = imagesToConvert.length;

  if (total === 0) {
    img2pdfFileSection.hidden = true;
    img2pdfBtn.disabled = true;
    return;
  }

  img2pdfFileSection.hidden = false;
  img2pdfFileCount.textContent = `Selected images (${total})`;
  img2pdfBtn.disabled = false;

  imagesToConvert.forEach((file, index) => {
    const li = document.createElement('li');
    li.className = 'file-item';

    const badge = document.createElement('span');
    badge.className = 'file-index';
    badge.textContent = `${index + 1}.`;

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
    upBtn.className = 'btn-control';
    upBtn.title = 'Move up';
    upBtn.innerHTML = '&#8593;';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', () => moveImg2PdfFile(index, -1));

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'btn-control';
    downBtn.title = 'Move down';
    downBtn.innerHTML = '&#8595;';
    downBtn.disabled = index === total - 1;
    downBtn.addEventListener('click', () => moveImg2PdfFile(index, 1));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-control btn-delete';
    deleteBtn.title = 'Remove';
    deleteBtn.innerHTML = '&#10005;';
    deleteBtn.addEventListener('click', () => removeImg2PdfFile(index));

    controls.appendChild(upBtn);
    controls.appendChild(downBtn);
    controls.appendChild(deleteBtn);

    li.appendChild(badge);
    li.appendChild(details);
    li.appendChild(controls);

    img2pdfFileList.appendChild(li);
  });
}

function handleImg2PdfFiles(files: FileList | null): void {
  if (!files || files.length === 0) return;

  clearMessages();
  let invalidFound = false;

  Array.from(files).forEach((file) => {
    const isImage =
      file.type.startsWith('image/') ||
      /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name);
    if (isImage) {
      imagesToConvert.push(file);
    } else {
      invalidFound = true;
    }
  });

  if (invalidFound) {
    showError('One or more selected files were skipped because they are not supported image formats.');
  }

  renderImg2PdfList();
}

function moveImg2PdfFile(fromIndex: number, direction: number): void {
  const toIndex = fromIndex + direction;
  if (toIndex < 0 || toIndex >= imagesToConvert.length) return;

  const [moved] = imagesToConvert.splice(fromIndex, 1);
  imagesToConvert.splice(toIndex, 0, moved);
  renderImg2PdfList();
}

function removeImg2PdfFile(index: number): void {
  imagesToConvert.splice(index, 1);
  renderImg2PdfList();
}

img2pdfClearAllBtn.addEventListener('click', () => {
  imagesToConvert = [];
  img2pdfFileInput.value = '';
  img2pdfAddMoreInput.value = '';
  clearMessages();
  renderImg2PdfList();
});

img2pdfDropzone.addEventListener('click', () => img2pdfFileInput.click());
img2pdfDropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    img2pdfFileInput.click();
  }
});

img2pdfFileInput.addEventListener('change', () => {
  handleImg2PdfFiles(img2pdfFileInput.files);
  img2pdfFileInput.value = '';
});

img2pdfAddMoreInput.addEventListener('change', () => {
  handleImg2PdfFiles(img2pdfAddMoreInput.files);
  img2pdfAddMoreInput.value = '';
});

['dragenter', 'dragover'].forEach((eventName) => {
  img2pdfDropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    img2pdfDropzone.classList.add('drag-active');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  img2pdfDropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    img2pdfDropzone.classList.remove('drag-active');
  });
});

img2pdfDropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer && e.dataTransfer.files) {
    handleImg2PdfFiles(e.dataTransfer.files);
  }
});

img2pdfBtn.addEventListener('click', async () => {
  if (imagesToConvert.length === 0) {
    showError('Please select at least one image file to convert.');
    return;
  }

  clearMessages();
  const originalHtml = img2pdfBtn.innerHTML;
  img2pdfBtn.disabled = true;
  img2pdfBtn.innerHTML = '<span class="spinner"></span> <span>Converting to PDF...</span>';

  try {
    const pdfBytes = await imagesToPdf(imagesToConvert);
    triggerDownload(pdfBytes, 'converted-images.pdf');
    showSuccess('PDF document generated successfully. Download started.');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An error occurred while creating the PDF document.';
    showError(message);
  } finally {
    img2pdfBtn.innerHTML = originalHtml;
    img2pdfBtn.disabled = imagesToConvert.length === 0;
  }
});

/* =========================================================
   4. PDF TO IMAGE TOOL
   ========================================================= */
let pdfToConvertFile: File | null = null;
let convertedBaseName = 'page';

const pdf2imgDropzone = document.getElementById('pdf2img-dropzone') as HTMLDivElement;
const pdf2imgFileInput = document.getElementById('pdf2img-file-input') as HTMLInputElement;
const pdf2imgFileCard = document.getElementById('pdf2img-file-card') as HTMLDivElement;
const pdf2imgFileName = document.getElementById('pdf2img-file-name') as HTMLElement;
const pdf2imgFileSize = document.getElementById('pdf2img-file-size') as HTMLElement;
const pdf2imgRemoveFile = document.getElementById('pdf2img-remove-file') as HTMLButtonElement;
const pdf2imgBtn = document.getElementById('pdf2img-btn') as HTMLButtonElement;
const pdf2imgResults = document.getElementById('pdf2img-results') as HTMLDivElement;
const pdf2imgPageCount = document.getElementById('pdf2img-page-count') as HTMLElement;
const pdf2imgPagesList = document.getElementById('pdf2img-pages-list') as HTMLDivElement;
const pdf2imgDownloadHint = document.getElementById('pdf2img-download-hint') as HTMLElement;

function handlePdf2ImgFile(files: FileList | null): void {
  if (!files || files.length === 0) return;

  clearMessages();
  pdf2imgResults.hidden = true;

  const file = files[0];
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (!isPdf) {
    showError(`"${file.name}" is not a valid PDF file. Please select a .pdf file.`);
    return;
  }

  pdfToConvertFile = file;
  convertedBaseName = file.name.replace(/\.pdf$/i, '');
  pdf2imgFileName.textContent = file.name;
  pdf2imgFileSize.textContent = formatBytes(file.size);

  pdf2imgDropzone.hidden = true;
  pdf2imgFileCard.hidden = false;
  pdf2imgBtn.disabled = false;
}

function clearPdf2ImgFile(): void {
  pdfToConvertFile = null;
  pdf2imgFileInput.value = '';
  pdf2imgDropzone.hidden = false;
  pdf2imgFileCard.hidden = true;
  pdf2imgBtn.disabled = true;
  pdf2imgResults.hidden = true;
  clearMessages();
}

pdf2imgRemoveFile.addEventListener('click', clearPdf2ImgFile);

pdf2imgDropzone.addEventListener('click', () => pdf2imgFileInput.click());
pdf2imgDropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    pdf2imgFileInput.click();
  }
});

pdf2imgFileInput.addEventListener('change', () => {
  handlePdf2ImgFile(pdf2imgFileInput.files);
});

['dragenter', 'dragover'].forEach((eventName) => {
  pdf2imgDropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    pdf2imgDropzone.classList.add('drag-active');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  pdf2imgDropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    pdf2imgDropzone.classList.remove('drag-active');
  });
});

pdf2imgDropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer && e.dataTransfer.files) {
    handlePdf2ImgFile(e.dataTransfer.files);
  }
});

pdf2imgBtn.addEventListener('click', async () => {
  if (!pdfToConvertFile) {
    showError('Please select a PDF file to convert.');
    return;
  }

  clearMessages();
  pdf2imgResults.hidden = true;

  const originalHtml = pdf2imgBtn.innerHTML;
  pdf2imgBtn.disabled = true;
  pdf2imgBtn.innerHTML = '<span class="spinner"></span> <span>Rendering pages...</span>';

  try {
    const blobs = await pdfToImages(pdfToConvertFile, (current, total) => {
      pdf2imgBtn.innerHTML = `<span class="spinner"></span> <span>Rendering page ${current} of ${total}...</span>`;
    });

    pdf2imgPageCount.textContent = String(blobs.length);
    pdf2imgPagesList.innerHTML = '';

    // Render individual download buttons
    blobs.forEach((blob, idx) => {
      const pageNumber = idx + 1;
      const dlBtn = document.createElement('button');
      dlBtn.type = 'button';
      dlBtn.className = 'btn-page-dl';
      dlBtn.textContent = `Page ${pageNumber} (PNG)`;
      dlBtn.addEventListener('click', () => {
        triggerDownload(blob, `${convertedBaseName}-page-${pageNumber}.png`, 'image/png');
      });
      pdf2imgPagesList.appendChild(dlBtn);
    });

    pdf2imgResults.hidden = false;
    pdf2imgDownloadHint.textContent =
      blobs.length === 1
        ? 'Download started automatically.'
        : `All ${blobs.length} pages are downloading automatically. You can also save individual pages below.`;

    // Stagger automatic download of pages so browser doesn't block rapid downloads
    blobs.forEach((blob, idx) => {
      setTimeout(() => {
        const pageNumber = idx + 1;
        const pageFileName =
          blobs.length === 1
            ? `${convertedBaseName}.png`
            : `${convertedBaseName}-page-${pageNumber}.png`;
        triggerDownload(blob, pageFileName, 'image/png');
      }, idx * 250);
    });

    showSuccess('Document converted to images successfully. Download started.');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An error occurred while converting the document.';
    showError(message);
  } finally {
    pdf2imgBtn.innerHTML = originalHtml;
    pdf2imgBtn.disabled = !pdfToConvertFile;
  }
});
