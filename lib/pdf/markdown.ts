/**
 * Markdown structure generation from extracted PDF text runs.
 */

import { ExtractedText, TextRun } from './text-extractor';

/** A single line of output markdown plus its heading path. */
export type MarkdownLine = {
  text: string;
  headingPath: string;
};

/** Result of building markdown from extracted PDF text. */
export type MarkdownResult = {
  markdown: string;
  lines: MarkdownLine[];
  metadata?: {
    bodyFontSize: number;
    pageCount: number;
  };
};

/** Compute the most common rounded font size across all text runs. */
const computeBodyFontSize = (runs: TextRun[]): number => {
  if (runs.length === 0) {
    return 0;
  }

  const fontSizeCounts = countFontSizes(runs);
  return findMostCommonFontSize(fontSizeCounts);
};

const countFontSizes = (runs: TextRun[]): Map<number, number> => {
  const counts = new Map<number, number>();

  for (const run of runs) {
    const roundedSize = Math.round(run.fontSize);
    const currentCount = counts.get(roundedSize) ?? 0;
    counts.set(roundedSize, currentCount + 1);
  }

  return counts;
};

const findMostCommonFontSize = (fontSizeCounts: Map<number, number>): number => {
  let mostCommonSize = 0;
  let highestCount = 0;

  for (const [size, count] of fontSizeCounts) {
    if (count <= highestCount) {
      continue;
    }
    highestCount = count;
    mostCommonSize = size;
  }

  return mostCommonSize;
};

/** Convert extracted text into markdown or plain text. */
export const buildMarkdown = (
  extracted: ExtractedText,
  includeStructure: boolean,
): MarkdownResult => {
  const allRuns = extracted.pages.flat();
  const bodyFontSize = computeBodyFontSize(allRuns);

  if (!includeStructure || bodyFontSize === 0) {
    return buildPlainTextResult(extracted, bodyFontSize);
  }

  return buildStructuredResult(extracted, bodyFontSize);
};

const buildPlainTextResult = (
  extracted: ExtractedText,
  bodyFontSize: number,
): MarkdownResult => {
  const plainText = extracted.pages
    .map((runs) => runs.map((run) => run.text).join(' '))
    .join('\n\n');

  return {
    markdown: plainText,
    lines: [],
    metadata: { bodyFontSize, pageCount: extracted.totalPageCount },
  };
};

const buildStructuredResult = (
  extracted: ExtractedText,
  bodyFontSize: number,
): MarkdownResult => {
  // TODO: heading detection, list detection, heading path

  return {
    markdown: '',
    lines: [],
    metadata: { bodyFontSize, pageCount: extracted.totalPageCount },
  };
};
