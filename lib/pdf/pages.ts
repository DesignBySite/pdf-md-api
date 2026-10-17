/**
 * Page selector parsing for PDF extraction.
 */

import { pageRangeInvalidError } from '@/lib/error-factories';

/** Parse a single page number token. */
const parseSinglePage = (token: string, totalPageCount: number): number | Response => {
  const page = parseInt(token, 10);

  if (!isValidPageNumber(page, totalPageCount)) {
    return pageRangeInvalidError();
  }

  return page;
};

const isValidPageNumber = (page: number, totalPageCount: number): boolean =>
  !Number.isNaN(page) && page >= 1 && page <= totalPageCount;

/** Parse a page range token like "3-7". */
const parsePageRange = (token: string, totalPageCount: number): number[] | Response => {
  const [startRaw, endRaw] = token.split('-');
  const start = parseInt(startRaw.trim(), 10);
  const end = parseInt(endRaw.trim(), 10);

  if (!isValidPageRange(start, end, totalPageCount)) {
    return pageRangeInvalidError();
  }

  return buildPageRange(start, end);
};

const isValidPageRange = (
  start: number,
  end: number,
  totalPageCount: number,
): boolean =>
  !Number.isNaN(start) &&
  !Number.isNaN(end) &&
  start >= 1 &&
  end >= start &&
  start <= totalPageCount &&
  end <= totalPageCount;

const buildPageRange = (start: number, end: number): number[] => {
  const pages: number[] = [];

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  return pages;
};

/** Parse a page selector string into a sorted, deduplicated page list. */
export const parsePageSelector = (
  selector: string,
  totalPageCount: number,
): number[] | Response => {
  const selected = new Set<number>();

  for (const rawToken of selector.split(',')) {
    const token = rawToken.trim();

    if (!token) {
      continue;
    }

    const addResult = addTokenToSelection(token, totalPageCount, selected);
    if (addResult instanceof Response) {
      return addResult;
    }
  }

  if (selected.size === 0) {
    return pageRangeInvalidError();
  }

  return sortPageSelection(selected);
};

const addTokenToSelection = (
  token: string,
  totalPageCount: number,
  selected: Set<number>,
): void | Response => {
  if (token.includes('-')) {
    return addRangeToSelection(token, totalPageCount, selected);
  }

  return addSinglePageToSelection(token, totalPageCount, selected);
};

const addSinglePageToSelection = (
  token: string,
  totalPageCount: number,
  selected: Set<number>,
): void | Response => {
  const page = parseSinglePage(token, totalPageCount);
  if (page instanceof Response) {
    return page;
  }
  selected.add(page);
};

const addRangeToSelection = (
  token: string,
  totalPageCount: number,
  selected: Set<number>,
): void | Response => {
  const range = parsePageRange(token, totalPageCount);
  if (range instanceof Response) {
    return range;
  }

  for (const page of range) {
    selected.add(page);
  }
};

const sortPageSelection = (selected: Set<number>): number[] =>
  Array.from(selected).sort((a, b) => a - b);
