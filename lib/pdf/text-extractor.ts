/**
 * PDF text extraction using pdfjs-dist (legacy build, worker disabled).
 *
 * Extracts positioned text runs, reconstructs reading-ordered lines, detects
 * two-column layouts, and rejoins hyphenated words.
 */

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  assignColumnIndices,
  clusterColumns,
  groupIntoLines,
  LINE_TOLERANCE_PX,
  rejoinHyphenation,
  reorderTwoColumn,
} from './layout';
import { parsePageSelector } from './pages';
import { hasTextContent, toTextRun } from './text-item';

// Point pdfjs to the bundled worker so it can be used in Node.js/Next.js.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url,
).toString();

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

/** Main entry point: extract text from PDF bytes. */
export const extractText = async (
  pdfBytes: Uint8Array,
  pageSelector?: string,
): Promise<ExtractedText | Response> => {
  const loadingTask = pdfjs.getDocument({ data: pdfBytes });
  const pdfDocument = await loadingTask.promise;
  const totalPageCount = pdfDocument.numPages;

  const targetPages = resolveTargetPages(pageSelector, totalPageCount);
  if (targetPages instanceof Response) {
    return targetPages;
  }

  const pages: TextRun[][] = [];

  for (const pageNumber of targetPages) {
    const page = await pdfDocument.getPage(pageNumber);
    const pageRuns = await extractOrderedPageRuns(page);
    pages.push(pageRuns);
  }

  return { pages, totalPageCount };
};

const resolveTargetPages = (
  pageSelector: string | undefined,
  totalPageCount: number,
): number[] | Response => {
  if (!pageSelector) {
    return buildPageRange(totalPageCount);
  }

  return parsePageSelector(pageSelector, totalPageCount);
};

const buildPageRange = (totalPageCount: number): number[] =>
  Array.from({ length: totalPageCount }, (_, index) => index + 1);

const extractOrderedPageRuns = async (page: unknown): Promise<TextRun[]> => {
  const runs = await extractTextRunsFromPage(page);
  const lines = groupIntoLines(runs);
  const { columnBands, columnCount } = clusterColumns(lines);
  const linesWithColumns = assignColumnIndices(lines, columnBands);
  const orderedLines = columnCount === 2 ? reorderTwoColumn(linesWithColumns) : linesWithColumns;
  const joinedLines = rejoinHyphenation(orderedLines);

  return joinedLines.flat();
};

/** Extract text runs from a single PDF page. */
const extractTextRunsFromPage = async (page: unknown): Promise<TextRun[]> => {
  const pdfPage = page as { getTextContent: () => Promise<{ items: unknown[] }> };
  const content = await pdfPage.getTextContent();
  const items = content.items as unknown as import('./text-item').TextItem[];

  return items.filter(hasTextContent).map(toTextRun);
};

/** Join extracted runs into plain text, one line per original line. */
export const toPlainText = (extracted: ExtractedText): string => {
  return extracted.pages
    .map((runs) => buildPagePlainText(runs))
    .join('\n\n');
};

const buildPagePlainText = (runs: TextRun[]): string => {
  const lines = rebuildLinesFromRuns(runs);
  return lines.join('\n');
};

const rebuildLinesFromRuns = (runs: TextRun[]): string[] => {
  if (runs.length === 0) {
    return [];
  }

  const lines: string[] = [];
  let currentY: number | null = null;
  let currentLine = '';

  for (const run of runs) {
    if (isNewLine(run, currentY)) {
      lines.push(currentLine.trim());
      currentLine = '';
    }
    currentLine += run.text;
    currentY = run.y;
  }

  if (currentLine.trim().length > 0) {
    lines.push(currentLine.trim());
  }

  return lines;
};

const isNewLine = (run: TextRun, currentY: number | null): boolean =>
  currentY !== null && Math.abs(run.y - currentY) > LINE_TOLERANCE_PX;
