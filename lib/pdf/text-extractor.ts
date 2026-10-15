/**
 * PDF text extraction using pdfjs-dist (legacy build, worker disabled).
 *
 * Extracts positioned text runs, reconstructs reading-ordered lines, detects
 * two-column layouts, and rejoins hyphenated words.
 */

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parsePageSelector } from './pages';

// Point pdfjs to the bundled worker so it can be used in Node.js/Next.js.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url,
).toString();

/** Tolerance for grouping text runs on the same line by y-coordinate (px). */
export const LINE_TOLERANCE_PX = 3;

/** Minimum horizontal gap between column bands (px). */
export const COLUMN_GAP_PX = 40;

/** Fraction of lines that must fall into two column bands to trigger two-column mode. */
export const TWO_COLUMN_THRESHOLD = 0.6;

/** Single positioned text run returned by pdfjs-dist. */
export type TextRun = {
  y: number;
  x: number;
  fontSize: number;
  bold: boolean;
  text: string;
  columnIndex: number;
};

/** Extracted text content per page plus document metadata. */
export type ExtractedText = {
  pages: TextRun[][];
  totalPageCount: number;
};

/** Determine whether a font string looks bold. */
const isBoldFont = (fontName: string): boolean =>
  /bold|black|heavy|demi/i.test(fontName);

/** Convert a pdfjs text item into our TextRun shape. */
const toTextRun = (item: TextItem): TextRun => {
  const text = 'str' in item ? (item.str as string) : '';
  const fontName = 'fontName' in item ? (item.fontName as string) : '';
  const transform = 'transform' in item ? (item.transform as number[]) : [1, 0, 0, 1, 0, 0];
  const width = 'width' in item ? (item.width as number) : 0;
  const height = 'height' in item ? (item.height as number) : 0;

  const x = transform[4] ?? 0;
  const y = transform[5] ?? 0;
  const fontSize = Math.max(width, height);

  return {
    x,
    y,
    fontSize,
    bold: isBoldFont(fontName),
    text,
    columnIndex: 0,
  };
};

/** Minimal TextItem interface to avoid deep pdfjs types. */
type TextItem = {
  str: string;
  dir: string;
  width: number;
  height: number;
  transform: number[];
  fontName: string;
  hasEOL?: boolean;
};

/** Group a flat list of runs into lines by y-coordinate. */
const groupIntoLines = (runs: TextRun[]): TextRun[][] => {
  if (runs.length === 0) return [];

  const sortedByY = [...runs].sort((a, b) => a.y - b.y);
  const lines: TextRun[][] = [];
  let currentLine: TextRun[] = [sortedByY[0]];

  for (let i = 1; i < sortedByY.length; i += 1) {
    const run = sortedByY[i];
    const lastRun = currentLine[currentLine.length - 1];

    if (Math.abs(run.y - lastRun.y) <= LINE_TOLERANCE_PX) {
      currentLine.push(run);
    } else {
      lines.push(currentLine);
      currentLine = [run];
    }
  }

  lines.push(currentLine);
  return lines.map((line) => line.sort((a, b) => a.x - b.x));
};

/** Cluster line x-starts into column bands and decide column count. */
const clusterColumns = (lines: TextRun[][]): { bands: number[]; columnCount: number } => {
  if (lines.length === 0) {
    return { bands: [], columnCount: 1 };
  }

  const starts = lines.map((line) => line[0].x).sort((a, b) => a - b);
  const bands: number[] = [];

  for (const x of starts) {
    const existing = bands.find((band) => Math.abs(band - x) <= COLUMN_GAP_PX);
    if (!existing) {
      bands.push(x);
    }
  }

  bands.sort((a, b) => a - b);

  if (bands.length < 2) {
    return { bands, columnCount: 1 };
  }

  const linesInLeft = lines.filter((line) =>
    bands.some((band) => Math.abs(band - line[0].x) <= COLUMN_GAP_PX && band === bands[0]),
  ).length;

  const linesInRight = lines.filter((line) =>
    bands.some((band) => Math.abs(band - line[0].x) <= COLUMN_GAP_PX && band === bands[1]),
  ).length;

  const twoColumnShare = (linesInLeft + linesInRight) / lines.length;
  const columnCount = twoColumnShare >= TWO_COLUMN_THRESHOLD ? 2 : 1;

  return { bands, columnCount };
};

/** Assign each run to the nearest column band. */
const assignColumnIndices = (lines: TextRun[][], bands: number[]): TextRun[][] => {
  if (bands.length < 2) return lines;

  return lines.map((line) =>
    line.map((run) => {
      const distances = bands.map((band) => Math.abs(band - run.x));
      const minIndex = distances.indexOf(Math.min(...distances));
      return { ...run, columnIndex: minIndex };
    }),
  );
};

/** Reorder two-column lines: read left column fully, then right column. */
const reorderTwoColumn = (lines: TextRun[][]): TextRun[][] => {
  const leftLines = lines.filter((line) => line[0].columnIndex === 0);
  const rightLines = lines.filter((line) => line[0].columnIndex === 1);

  const leftSorted = leftLines.sort((a, b) => a[0].y - b[0].y);
  const rightSorted = rightLines.sort((a, b) => a[0].y - b[0].y);

  return [...leftSorted, ...rightSorted];
};

/** Detect trailing hyphen and rejoin with the next line's first word. */
const rejoinHyphenation = (lines: TextRun[][]): TextRun[][] => {
  const result: TextRun[][] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lastRun = line[line.length - 1];

    if (!lastRun || !lastRun.text.endsWith('-')) {
      result.push(line);
      continue;
    }

    const nextLine = lines[i + 1];
    if (!nextLine || nextLine.length === 0) {
      result.push(line);
      continue;
    }

    const firstRun = nextLine[0];
    const mergedText = lastRun.text.slice(0, -1) + firstRun.text;

    const mergedLine = [
      ...line.slice(0, -1),
      { ...lastRun, text: mergedText },
      ...nextLine.slice(1),
    ];

    result.push(mergedLine);
    i += 1;
  }

  return result;
};

/** Extract text runs from a single PDF page. */
const extractPageText = async (page: unknown): Promise<TextRun[]> => {
  const pdfPage = page as { getTextContent: () => Promise<{ items: unknown[] }> };
  const content = await pdfPage.getTextContent();
  const items = content.items as unknown as TextItem[];

  return items
    .filter((item) => item.str && item.str.trim().length > 0)
    .map(toTextRun);
};

/** Main entry point: extract text from PDF bytes. */
export const extractText = async (
  pdfBytes: Uint8Array,
  pageSelector?: string,
): Promise<ExtractedText | Response> => {
  const loadingTask = pdfjs.getDocument({ data: pdfBytes });
  const pdfDocument = await loadingTask.promise;
  const totalPageCount = pdfDocument.numPages;

  let targetPages: number[];
  if (pageSelector) {
    const parsed = parsePageSelector(pageSelector, totalPageCount);
    if (parsed instanceof Response) {
      return parsed;
    }
    targetPages = parsed;
  } else {
    targetPages = Array.from({ length: totalPageCount }, (_, i) => i + 1);
  }

  const pages: TextRun[][] = [];

  for (const pageNumber of targetPages) {
    const page = await pdfDocument.getPage(pageNumber);
    const runs = await extractPageText(page);
    const lines = groupIntoLines(runs);
    const { bands, columnCount } = clusterColumns(lines);
    const linesWithColumns = assignColumnIndices(lines, bands);
    const orderedLines =
      columnCount === 2 ? reorderTwoColumn(linesWithColumns) : linesWithColumns;
    const joinedLines = rejoinHyphenation(orderedLines);

    const pageRuns = joinedLines.flat();
    pages.push(pageRuns);
  }

  return { pages, totalPageCount };
};

/** Join extracted runs into plain text, one line per original line. */
export const toPlainText = (extracted: ExtractedText): string => {
  return extracted.pages
    .map((runs) => {
      const lines: string[] = [];
      let currentY: number | null = null;
      let currentLine = '';

      for (const run of runs) {
        if (currentY !== null && Math.abs(run.y - currentY) > LINE_TOLERANCE_PX) {
          lines.push(currentLine.trim());
          currentLine = '';
        }
        currentLine += run.text;
        currentY = run.y;
      }

      if (currentLine.trim().length > 0) {
        lines.push(currentLine.trim());
      }

      return lines.join('\n');
    })
    .join('\n\n');
};
