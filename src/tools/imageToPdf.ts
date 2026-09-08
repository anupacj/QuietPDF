import { PDFDocument } from 'pdf-lib';

/**
 * Converts a raw image file into PNG bytes via an offscreen canvas fallback.
 * Useful when an image has an uncommon encoding (e.g. WebP, Progressive JPEG)
 * not directly parseable by pdf-lib's built-in embedders.
 */
async function fallbackToPngBytes(file: File): Promise<Uint8Array> {
  const blobUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to decode "${file.name}".`));
      img.src = blobUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    ctx.drawImage(img, 0, 0);

    const pngBlob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/png');
    });
    return new Uint8Array(await pngBlob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Converts multiple image files (JPEG, PNG, etc.) into a single PDF document.
 * Each image becomes a page sized to the image's dimensions.
 *
 * @param files - Array of image File objects in the desired page order
 * @returns Promise resolving to the generated PDF as Uint8Array
 */
export async function imagesToPdf(files: File[]): Promise<Uint8Array> {
  if (!files || files.length === 0) {
    throw new Error('Please select at least one image file to convert.');
  }

  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
    } catch {
      throw new Error(`Failed to read "${file.name}".`);
    }

    const bytes = new Uint8Array(arrayBuffer);

    // Detect format based on magic bytes or MIME type / file name
    const isPng =
      (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) ||
      file.type === 'image/png' ||
      file.name.toLowerCase().endsWith('.png');

    let embeddedImage;

    try {
      if (isPng) {
        embeddedImage = await pdfDoc.embedPng(bytes);
      } else {
        embeddedImage = await pdfDoc.embedJpg(bytes);
      }
    } catch {
      // Fallback: If native embedding fails (e.g. progressive JPEG, WebP, etc.),
      // decode in browser and embed as standard PNG
      try {
        const fallbackBytes = await fallbackToPngBytes(file);
        embeddedImage = await pdfDoc.embedPng(fallbackBytes);
      } catch {
        throw new Error(
          `Could not embed "${file.name}". Please ensure it is a valid JPEG, PNG, or WebP image.`
        );
      }
    }

    // Add page sized precisely to image dimensions
    const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: embeddedImage.width,
      height: embeddedImage.height,
    });
  }

  return await pdfDoc.save();
}
