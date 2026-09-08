import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure the worker URL for pdfjs in Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Converts each page of a PDF document into a PNG Blob.
 *
 * @param file - The input PDF file
 * @param onProgress - Optional callback reporting rendering progress (currentPage, totalPages)
 * @returns Promise resolving to an array of PNG Blobs (one per page)
 */
export async function pdfToImages(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<Blob[]> {
  if (!file) {
    throw new Error('Please select a PDF file to convert.');
  }

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch {
    throw new Error(`Failed to read "${file.name}".`);
  }

  let pdfDoc: pdfjsLib.PDFDocumentProxy;
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
    });
    pdfDoc = await loadingTask.promise;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('encrypt')) {
      throw new Error(`"${file.name}" is password-protected or encrypted.`);
    }
    throw new Error(`Could not load "${file.name}". Please ensure it is a valid PDF.`);
  }

  const numPages = pdfDoc.numPages;
  if (numPages === 0) {
    throw new Error('The PDF document contains no pages.');
  }

  const blobs: Blob[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(pageNum, numPages);

    const page = await pdfDoc.getPage(pageNum);
    // Render at 2.0x scale (~144-150 DPI) for crisp, readable text and graphics
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not create canvas 2D context for rendering.');
    }

    // Default white background since PDF viewports can be transparent
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render page
    const renderContext = {
      canvas: canvas,
      canvasContext: ctx,
      viewport: viewport,
    };

    await page.render(renderContext).promise;

    // Convert canvas to PNG blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error(`Failed to export page ${pageNum} as PNG.`))),
        'image/png'
      );
    });

    blobs.push(blob);
  }

  return blobs;
}
