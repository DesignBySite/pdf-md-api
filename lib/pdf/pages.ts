/**
 * Page selector parsing for PDF extraction.
 */

import { pageRangeInvalidError } from '@/lib/error-factories';

/** Parse a single page number token. */
const parseSinglePage = (trimmed: string, totalPages: number): number | Response => {
  const page = parseInt(trimmed, 10);
  if (Number.isNaN(page) || page < 1 || page > totalPages) {
    return pageRangeInvalidError();
  }
  return page;
};

/** Parse a page range token like "3-7". */
const parsePageRange = (trimmed: string, totalPages: number): number[] | Response => {
  const [startRaw, endRaw] = trimmed.split('-');
  const start = parseInt(startRaw.trim(), 10);
  const end = parseInt(endRaw.trim(), 10);

  if (
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    start < 1 ||
    end < start ||
    start > totalPages ||
    end > totalPages
  ) {
    return pageRangeInvalidError();
  }

  const pages: number[] = [];
  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }
  return pages;
};

/** Parse a page selector string into a sorted, deduplicated page list. */
export const parsePageSelector = (
  selector: string,
  totalPages: number,
): number[] | Response => {
  const selected = new Set<number>();

  for (const part of selector.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (!trimmed.includes('-')) {
      const page = parseSinglePage(trimmed, totalPages);
      if (page instanceof Response) return page;
      selected.add(page);
      continue;
    }

    const range = parsePageRange(trimmed, totalPages);
    if (range instanceof Response) return range;
    for (const page of range) {
      selected.add(page);
    }
  }

  if (selected.size === 0) {
    return pageRangeInvalidError();
  }

  return Array.from(selected).sort((a, b) => a - b);
};
