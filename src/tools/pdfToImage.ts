import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';

// Configure the worker URL for pdfjs in Vite
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

/**
 * Loads a PDF document safely from a File object.
 *
 * @param file - The input PDF File
 * @returns Promise resolving to a PDFDocumentProxy
 */
export async function loadPdfDocument(file: File): Promise<pdfjsLib.PDFDocumentProxy> {
  if (!file) {
    throw new Error('Please select a PDF file to convert.');
  }

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch {
    throw new Error(`Failed to read "${file.name}".`);
  }

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
    });
    return await loadingTask.promise;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('encrypt')) {
      throw new Error(`"${file.name}" is password-protected or encrypted.`);
    }
    throw new Error(`Could not load "${file.name}". Please ensure it is a valid PDF.`);
  }
}

/**
 * Renders a single page of a PDF document as a lightweight thumbnail preview.
 * Immediately cleans up the canvas and page to minimize RAM consumption.
 *
 * @param pdfDoc - Loaded PDFDocumentProxy
 * @param pageNum - 1-indexed page number
 * @param maxDim - Maximum width or height of thumbnail in pixels (default: 180)
 * @returns Promise resolving to a JPEG data URL string
 */
export async function renderThumbnail(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  maxDim = 180
): Promise<string> {
  const page = await pdfDoc.getPage(pageNum);
  try {
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const scale = Math.min(maxDim / unscaledViewport.width, maxDim / unscaledViewport.height, 0.45);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Could not create canvas 2D context.');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvas: canvas,
      canvasContext: ctx,
      viewport: viewport,
    }).promise;

    // Export thumbnail as compressed JPEG data URL
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

    // Immediate cleanup of canvas dimensions to free backing store memory
    canvas.width = 0;
    canvas.height = 0;

    return dataUrl;
  } finally {
    page.cleanup();
  }
}

/**
 * Renders selected pages one at a time at full resolution (2.0x scale),
 * adds each directly to a JSZip archive, and cleans up memory immediately per page.
 *
 * @param pdfDoc - Loaded PDFDocumentProxy
 * @param pageNumbers - Array of 1-indexed page numbers to export
 * @param onProgress - Optional callback for tracking export progress (current, total)
 * @returns Promise resolving to a ZIP Blob
 */
export async function exportPagesToZip(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumbers: number[],
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  if (!pageNumbers || pageNumbers.length === 0) {
    throw new Error('No pages selected to export.');
  }

  const sortedPages = [...pageNumbers].sort((a, b) => a - b);
  const zip = new JSZip();

  for (let i = 0; i < sortedPages.length; i++) {
    const pageNum = sortedPages[i];
    onProgress?.(i + 1, sortedPages.length);

    const page = await pdfDoc.getPage(pageNum);
    const canvas = document.createElement('canvas');

    try {
      // 2.0x scale provides crisp ~150 DPI resolution for document text & graphics
      const viewport = page.getViewport({ scale: 2.0 });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not create canvas 2D context for rendering.');
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvas: canvas,
        canvasContext: ctx,
        viewport: viewport,
      }).promise;

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error(`Failed to export page ${pageNum} as PNG.`))),
          'image/png'
        );
      });

      // Name sequentially, e.g. page-1.png, page-2.png
      zip.file(`page-${pageNum}.png`, blob);
    } finally {
      // Free canvas buffer and page memory immediately after each page
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }
  }

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

/**
 * Backwards-compatible helper to render all pages as Blobs with memory cleanup.
 */
export async function pdfToImages(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<Blob[]> {
  const pdfDoc = await loadPdfDocument(file);
  const numPages = pdfDoc.numPages;
  const blobs: Blob[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(pageNum, numPages);
    const page = await pdfDoc.getPage(pageNum);
    const canvas = document.createElement('canvas');
    try {
      const viewport = page.getViewport({ scale: 2.0 });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas: canvas, canvasContext: ctx, viewport }).promise;
      }
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Render error'))), 'image/png');
      });
      blobs.push(blob);
    } finally {
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }
  }

  return blobs;
}
