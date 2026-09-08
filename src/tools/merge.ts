import { PDFDocument } from 'pdf-lib';

/**
 * Merges multiple PDF files into a single PDF document in the specified order.
 * All processing is done strictly client-side in the browser.
 *
 * @param files - Array of PDF File objects to merge in order
 * @returns Promise resolving to the merged PDF as a Uint8Array
 */
export async function mergePdfs(files: File[]): Promise<Uint8Array> {
  if (!files || files.length === 0) {
    throw new Error('Please select at least one PDF file to merge.');
  }

  const mergedDoc = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let arrayBuffer: ArrayBuffer;

    try {
      arrayBuffer = await file.arrayBuffer();
    } catch {
      throw new Error(`Failed to read "${file.name}". The file may be inaccessible.`);
    }

    let loadedDoc: PDFDocument;
    try {
      loadedDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('encrypt') || msg.toLowerCase().includes('password')) {
        throw new Error(`"${file.name}" is password-protected or encrypted. Please remove the password first.`);
      }
      throw new Error(`Could not load "${file.name}". It may be corrupted or not a valid PDF.`);
    }

    try {
      const pageIndices = loadedDoc.getPageIndices();
      const copiedPages = await mergedDoc.copyPages(loadedDoc, pageIndices);
      for (const page of copiedPages) {
        mergedDoc.addPage(page);
      }
    } catch {
      throw new Error(`Failed to extract pages from "${file.name}".`);
    }
  }

  return await mergedDoc.save();
}
