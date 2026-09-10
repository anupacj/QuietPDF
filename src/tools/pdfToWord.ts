import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Document, Paragraph, TextRun, Packer } from 'docx';

// Ensure worker URL is configured for pdf.js in Vite
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

interface TextSpan {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasEOL: boolean;
}

interface TextLine {
  y: number;
  height: number;
  text: string;
  hasEOL: boolean;
}

/**
 * Extracts paragraphs from pdf.js page text content items.
 * Groups items into visual lines by vertical position, and groups lines into paragraphs.
 */
function extractParagraphs(items: any[]): string[] {
  const spans: TextSpan[] = [];

  for (const item of items) {
    if (!item || typeof item.str !== 'string') continue;
    const str = item.str;
    if (!str && !item.hasEOL) continue;

    const transform = Array.isArray(item.transform) ? item.transform : [0, 0, 0, 0, 0, 0];
    const x = typeof transform[4] === 'number' ? transform[4] : 0;
    const y = typeof transform[5] === 'number' ? transform[5] : 0;
    const width = typeof item.width === 'number' ? item.width : 0;
    const height =
      typeof item.height === 'number' && item.height > 0
        ? item.height
        : Math.abs(transform[0]) || Math.abs(transform[3]) || 12;

    spans.push({
      str,
      x,
      y,
      width,
      height,
      hasEOL: Boolean(item.hasEOL),
    });
  }

  if (spans.length === 0) {
    return [];
  }

  // Sort spans primarily by y descending (top of page to bottom), then x ascending
  spans.sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > 3) {
      return yDiff;
    }
    return a.x - b.x;
  });

  // Group spans into lines
  const lines: TextLine[] = [];
  let currentGroup: { y: number; height: number; spans: TextSpan[] } | null = null;

  for (const span of spans) {
    if (!currentGroup) {
      currentGroup = { y: span.y, height: span.height, spans: [span] };
    } else {
      const yDiff = Math.abs(span.y - currentGroup.y);
      const tolerance = Math.max(2.5, Math.min(span.height, currentGroup.height) * 0.45);
      if (yDiff <= tolerance) {
        currentGroup.spans.push(span);
        currentGroup.height = Math.max(currentGroup.height, span.height);
      } else {
        lines.push(buildLine(currentGroup.spans, currentGroup.y, currentGroup.height));
        currentGroup = { y: span.y, height: span.height, spans: [span] };
      }
    }
  }

  if (currentGroup) {
    lines.push(buildLine(currentGroup.spans, currentGroup.y, currentGroup.height));
  }

  function buildLine(lineSpans: TextSpan[], y: number, height: number): TextLine {
    lineSpans.sort((a, b) => a.x - b.x);
    let lineText = '';
    let lastRight = -1;
    let hasEOL = false;

    for (const span of lineSpans) {
      if (span.hasEOL) hasEOL = true;
      if (!span.str) continue;

      if (lastRight >= 0 && span.x - lastRight > 2.5 && !lineText.endsWith(' ') && !span.str.startsWith(' ')) {
        lineText += ' ';
      }
      lineText += span.str;
      lastRight = span.x + span.width;
    }

    return {
      y,
      height,
      text: lineText.trim(),
      hasEOL,
    };
  }

  const validLines = lines.filter((l) => l.text.length > 0);
  if (validLines.length === 0) {
    return [];
  }

  // Group lines into paragraphs
  const paragraphs: string[] = [];
  let currentPara = '';
  let prevLine: TextLine | null = null;

  for (const line of validLines) {
    if (!prevLine) {
      currentPara = line.text;
      prevLine = line;
      continue;
    }

    // Gap between lines (y decreases down page)
    const gap = prevLine.y - line.y;
    const avgHeight = Math.max(line.height, prevLine.height);
    const isDistinctGap = gap >= avgHeight * 1.6 || gap >= 18;
    const prevEndsPunctuation = /[.!?:]$/.test(prevLine.text);

    if (isDistinctGap || (prevLine.hasEOL && prevEndsPunctuation && gap >= avgHeight * 1.25)) {
      if (currentPara.trim().length > 0) {
        paragraphs.push(currentPara.trim());
      }
      currentPara = line.text;
    } else {
      if (currentPara.endsWith('-')) {
        currentPara = currentPara.slice(0, -1) + line.text;
      } else if (!currentPara.endsWith(' ') && !line.text.startsWith(' ')) {
        currentPara += ' ' + line.text;
      } else {
        currentPara += line.text;
      }
    }

    prevLine = line;
  }

  if (currentPara.trim().length > 0) {
    paragraphs.push(currentPara.trim());
  }

  return paragraphs;
}

/**
 * Converts a PDF file into a Word document (.docx) as a byte array.
 * Extracts text content page by page, creating paragraphs in docx sections.
 *
 * @param file - The input PDF file
 * @param onProgress - Optional callback for tracking conversion progress (currentPage, totalPages)
 * @returns Promise resolving to a Uint8Array containing the .docx file bytes
 */
export async function pdfToWord(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<Uint8Array> {
  if (!file) {
    throw new Error('Please select a PDF file to convert.');
  }

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    throw new Error(`"${file.name}" is not a valid PDF file.`);
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

  const sections: { children: Paragraph[] }[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(pageNum, numPages);

    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    const paragraphStrings = extractParagraphs(content.items);

    const pageParagraphs: Paragraph[] =
      paragraphStrings.length > 0
        ? paragraphStrings.map(
            (pText) =>
              new Paragraph({
                children: [new TextRun({ text: pText })],
                spacing: { after: 120 }, // 6pt spacing after paragraph
              })
          )
        : [new Paragraph('')];

    sections.push({ children: pageParagraphs });
  }

  const doc = new Document({
    sections,
  });

  const docxArrayBuffer = await Packer.toArrayBuffer(doc);
  return new Uint8Array(docxArrayBuffer);
}
