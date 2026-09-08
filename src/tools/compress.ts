import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';

/**
 * Recompresses an image's raw bytes via an offscreen HTML <canvas> as JPEG.
 * Returns recompressed Uint8Array if smaller, or null if recompression failed or did not reduce size.
 */
async function recompressImage(
  imageBytes: Uint8Array,
  quality: number,
  isJpeg: boolean
): Promise<Uint8Array | null> {
  // Identify MIME type from magic numbers or PDF filter
  let mimeType = 'image/jpeg';
  if (
    imageBytes.length >= 4 &&
    imageBytes[0] === 0x89 &&
    imageBytes[1] === 0x50 &&
    imageBytes[2] === 0x4e &&
    imageBytes[3] === 0x47
  ) {
    mimeType = 'image/png';
  } else if (imageBytes.length >= 2 && imageBytes[0] === 0xff && imageBytes[1] === 0xd8) {
    mimeType = 'image/jpeg';
  } else if (!isJpeg) {
    // If not DCTDecode and not standard image container, skip
    return null;
  }

  const blob = new Blob([imageBytes as unknown as BlobPart], { type: mimeType });

  let width = 0;
  let height = 0;
  let drawImageToCanvas: (ctx: CanvasRenderingContext2D) => void;
  let cleanup: (() => void) | undefined;

  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    width = bitmap.width;
    height = bitmap.height;
    drawImageToCanvas = (ctx) => ctx.drawImage(bitmap, 0, 0);
    cleanup = () => bitmap.close();
  } else if (typeof Image !== 'undefined') {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to decode image element'));
      img.src = url;
    });
    width = img.naturalWidth;
    height = img.naturalHeight;
    drawImageToCanvas = (ctx) => ctx.drawImage(img, 0, 0);
    cleanup = () => URL.revokeObjectURL(url);
  } else {
    return null;
  }

  if (width <= 0 || height <= 0) {
    cleanup?.();
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    cleanup?.();
    return null;
  }

  // Draw white background for any transparency before JPEG conversion
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  drawImageToCanvas(ctx);
  cleanup?.();

  const compressedBlob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('canvas.toBlob failed'));
      },
      'image/jpeg',
      quality
    );
  });

  const compressedBuffer = await compressedBlob.arrayBuffer();
  const compressedBytes = new Uint8Array(compressedBuffer);

  // Only return if it actually reduced the image byte size
  if (compressedBytes.length < imageBytes.length) {
    return compressedBytes;
  }

  return null;
}

/**
 * Compresses a PDF file client-side by recompressing embedded images as JPEGs.
 *
 * @param file - The PDF File object to compress
 * @param quality - Compression quality between 0 and 1 (e.g. 0.6 = moderate compression)
 * @returns Promise resolving to compressed PDF Uint8Array
 */
export async function compressPdf(file: File, quality: number): Promise<Uint8Array> {
  if (!file) {
    throw new Error('Please select a PDF file to compress.');
  }

  const normalizedQuality = Math.max(0.1, Math.min(1.0, quality));

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch {
    throw new Error(`Failed to read "${file.name}". The file may be inaccessible.`);
  }

  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('encrypt') || msg.toLowerCase().includes('password')) {
      throw new Error(`"${file.name}" is password-protected or encrypted. Please remove the password first.`);
    }
    throw new Error(`Could not load "${file.name}". It may be corrupted or not a valid PDF.`);
  }

  const indirectObjects = pdfDoc.context.enumerateIndirectObjects();

  for (const [ref, obj] of indirectObjects) {
    if (obj instanceof PDFRawStream) {
      const subtype = obj.dict.get(PDFName.of('Subtype'));
      if (subtype?.toString() === '/Image') {
        try {
          const filter = obj.dict.get(PDFName.of('Filter'))?.toString();
          const isJpeg = filter === '/DCTDecode';
          const rawBytes = obj.contents;

          if (!rawBytes || rawBytes.length === 0) continue;

          const recompressed = await recompressImage(rawBytes, normalizedQuality, isJpeg);
          if (recompressed) {
            const newImg = await pdfDoc.embedJpg(recompressed);
            await newImg.embed();
            const newStream = pdfDoc.context.lookup(newImg.ref) as PDFRawStream;

            if (newStream) {
              const sMask = obj.dict.get(PDFName.of('SMask'));
              if (sMask) {
                newStream.dict.set(PDFName.of('SMask'), sMask);
              }
              pdfDoc.context.assign(ref, newStream);
              pdfDoc.context.delete(newImg.ref);
            }
          }
        } catch {
          // If an error occurs on a specific image, skip it and preserve the original
          continue;
        }
      }
    }
  }

  return await pdfDoc.save({ useObjectStreams: true });
}
