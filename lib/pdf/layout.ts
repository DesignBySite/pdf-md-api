/**
 * PDF page layout geometry: line grouping, column detection, reading order,
 * and hyphenation rejoining.
 */

import { TextRun } from './text-extractor';

/** Tolerance for grouping text runs on the same line by y-coordinate (px). */
export const LINE_TOLERANCE_PX = 3;

/** Minimum horizontal gap between column bands (px). */
export const COLUMN_GAP_PX = 40;

/** Fraction of lines that must fall into two column bands to trigger two-column mode. */
export const TWO_COLUMN_THRESHOLD = 0.6;

/** Group a flat list of runs into lines by y-coordinate. */
export const groupIntoLines = (runs: TextRun[]): TextRun[][] => {
  if (runs.length === 0) {
    return [];
  }

  const sortedByY = sortRunsByY(runs);
  const lines = splitRunsIntoLines(sortedByY);
  return sortEachLineByX(lines);
};

const sortRunsByY = (runs: TextRun[]): TextRun[] => [...runs].sort((a, b) => a.y - b.y);

const splitRunsIntoLines = (sortedRuns: TextRun[]): TextRun[][] => {
  const lines: TextRun[][] = [];
  let currentLine: TextRun[] = [sortedRuns[0]];

  for (let index = 1; index < sortedRuns.length; index += 1) {
    const run = sortedRuns[index];
    const lastRun = currentLine[currentLine.length - 1];

    if (runsAreOnSameLine(run, lastRun)) {
      currentLine.push(run);
      continue;
    }

    lines.push(currentLine);
    currentLine = [run];
  }

  lines.push(currentLine);
  return lines;
};

const runsAreOnSameLine = (run: TextRun, previousRun: TextRun): boolean =>
  Math.abs(run.y - previousRun.y) <= LINE_TOLERANCE_PX;

const sortEachLineByX = (lines: TextRun[][]): TextRun[][] => lines.map((line) => line.sort((a, b) => a.x - b.x));

/** Cluster line x-starts into column bands and decide column count. */
export const clusterColumns = (lines: TextRun[][]): { columnBands: number[]; columnCount: number } => {
  if (lines.length === 0) {
    return { columnBands: [], columnCount: 1 };
  }

  const columnBands = buildColumnBands(lines);

  if (columnBands.length < 2) {
    return { columnBands, columnCount: 1 };
  }

  const columnCount = isTwoColumnLayout(lines, columnBands) ? 2 : 1;
  return { columnBands, columnCount };
};

const buildColumnBands = (lines: TextRun[][]): number[] => {
  const sortedStarts = collectLineStartXs(lines);
  const columnBands: number[] = [];

  for (const startX of sortedStarts) {
    const existingBand = columnBands.find((band) => Math.abs(band - startX) <= COLUMN_GAP_PX);
    if (existingBand !== undefined) {
      continue;
    }
    columnBands.push(startX);
  }

  return columnBands.sort((a, b) => a - b);
};

const collectLineStartXs = (lines: TextRun[][]): number[] =>
  lines.map((line) => line[0].x).sort((a, b) => a - b);

const isTwoColumnLayout = (lines: TextRun[][], columnBands: number[]): boolean => {
  const linesInLeft = countLinesInBand(lines, columnBands[0], columnBands);
  const linesInRight = countLinesInBand(lines, columnBands[1], columnBands);
  const twoColumnShare = (linesInLeft + linesInRight) / lines.length;
  return twoColumnShare >= TWO_COLUMN_THRESHOLD;
};

const countLinesInBand = (
  lines: TextRun[][],
  targetBand: number,
  columnBands: number[],
): number =>
  lines.filter((line) =>
    columnBands.some(
      (band) => Math.abs(band - line[0].x) <= COLUMN_GAP_PX && band === targetBand,
    ),
  ).length;

/** Assign each run to the nearest column band. */
export const assignColumnIndices = (lines: TextRun[][], columnBands: number[]): TextRun[][] => {
  if (columnBands.length < 2) {
    return lines;
  }

  return lines.map((line) => line.map((run) => assignColumnIndex(run, columnBands)));
};

const assignColumnIndex = (run: TextRun, columnBands: number[]): TextRun => ({
  ...run,
  columnIndex: findNearestBandIndex(run.x, columnBands),
});

const findNearestBandIndex = (x: number, columnBands: number[]): number => {
  const distances = columnBands.map((band) => Math.abs(band - x));
  return distances.indexOf(Math.min(...distances));
};

/** Reorder two-column lines: read left column fully, then right column. */
export const reorderTwoColumn = (lines: TextRun[][]): TextRun[][] => {
  const leftLines = lines.filter((line) => line[0].columnIndex === 0);
  const rightLines = lines.filter((line) => line[0].columnIndex === 1);

  return [
    ...sortLinesByY(leftLines),
    ...sortLinesByY(rightLines),
  ];
};

const sortLinesByY = (lines: TextRun[][]): TextRun[][] =>
  [...lines].sort((a, b) => a[0].y - b[0].y);

/** Detect trailing hyphen and rejoin with the next line's first word. */
export const rejoinHyphenation = (lines: TextRun[][]): TextRun[][] => {
  const result: TextRun[][] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const currentLine = lines[index];
    const nextLine = lines[index + 1];

    const mergeResult = mergeHyphenatedLine(currentLine, nextLine);
    result.push(mergeResult.line);
    index += mergeResult.linesToSkip;
  }

  return result;
};

const mergeHyphenatedLine = (
  currentLine: TextRun[],
  nextLine: TextRun[] | undefined,
): { line: TextRun[]; linesToSkip: number } => {
  const lastRun = currentLine[currentLine.length - 1];

  if (!hasTrailingHyphen(lastRun)) {
    return { line: currentLine, linesToSkip: 0 };
  }

  if (!nextLine || nextLine.length === 0) {
    return { line: currentLine, linesToSkip: 0 };
  }

  const mergedLine = buildMergedLine(currentLine, nextLine);
  return { line: mergedLine, linesToSkip: 1 };
};

const hasTrailingHyphen = (run: TextRun | undefined): boolean => run !== undefined && run.text.endsWith('-');

const buildMergedLine = (currentLine: TextRun[], nextLine: TextRun[]): TextRun[] => {
  const lastRun = currentLine[currentLine.length - 1];
  const firstRun = nextLine[0];
  const mergedText = lastRun.text.slice(0, -1) + firstRun.text;

  return [
    ...currentLine.slice(0, -1),
    { ...lastRun, text: mergedText },
    ...nextLine.slice(1),
  ];
};
