/**
 * Convert pdfjs-dist text items into our TextRun shape.
 */

import { TextRun } from './text-extractor';

/** Minimal TextItem interface to avoid deep pdfjs types. */
export type TextItem = {
  str: string;
  dir: string;
  width: number;
  height: number;
  transform: number[];
  fontName: string;
  hasEOL?: boolean;
};

/** Determine whether a font string looks bold. */
const isBoldFontName = (fontName: string): boolean =>
  /bold|black|heavy|demi/i.test(fontName);

const getItemText = (item: TextItem): string =>
  ('str' in item ? (item.str as string) : '');

const getFontName = (item: TextItem): string =>
  ('fontName' in item ? (item.fontName as string) : '');

const getTransform = (item: TextItem): number[] =>
  ('transform' in item ? (item.transform as number[]) : [1, 0, 0, 1, 0, 0]);

const getWidth = (item: TextItem): number =>
  ('width' in item ? (item.width as number) : 0);

const getHeight = (item: TextItem): number =>
  ('height' in item ? (item.height as number) : 0);

/** Convert a pdfjs text item into our TextRun shape. */
export const toTextRun = (item: TextItem): TextRun => {
  const text = getItemText(item);
  const fontName = getFontName(item);
  const transform = getTransform(item);
  const width = getWidth(item);
  const height = getHeight(item);

  const x = transform[4] ?? 0;
  const y = transform[5] ?? 0;
  const fontSize = Math.max(width, height);

  return {
    x,
    y,
    fontSize,
    bold: isBoldFontName(fontName),
    text,
    columnIndex: 0,
  };
};

export const hasTextContent = (item: TextItem): boolean =>
  Boolean(item.str && item.str.trim().length > 0);
