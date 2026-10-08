/**
 * Pre-built API error responses for the pdf-md-api error codes.
 *
 * Prefer these helpers in route handlers to keep status/code/message/hint
 * consistent and avoid leaking stack traces.
 */

import { apiError } from '@/lib/errors';

/** 400 invalid_url — malformed or non-http(s) URL, or bad JSON body. */
export const invalidUrlError = (): Response =>
  apiError(
    400,
    'invalid_url',
    'Request body must include a valid http:// or https:// URL.',
    'Send { "url": "https://example.com/file.pdf" }.',
  );

/** 502 fetch_failed — upstream unreachable, timeout, or non-2xx response. */
export const fetchFailedError = (): Response =>
  apiError(
    502,
    'fetch_failed',
    'Could not fetch the URL within 10 seconds or the upstream refused the connection.',
    'Ensure the URL is reachable and returns a PDF quickly.',
  );

/** 415 not_pdf — bytes do not start with %PDF-. */
export const notPdfError = (): Response =>
  apiError(
    415,
    'not_pdf',
    'The downloaded bytes do not look like a PDF.',
    'Verify the URL points to a real PDF file.',
  );

/** 413 too_large — payload exceeds MAX_PDF_BYTES. */
export const tooLargeError = (): Response =>
  apiError(
    413,
    'too_large',
    'The PDF file exceeds the 25 MB size limit.',
    'Please provide a PDF smaller than 25 MB.',
  );

/** 422 parse_failed — PDF could not be parsed. */
export const parseFailedError = (): Response =>
  apiError(
    422,
    'parse_failed',
    'The PDF could not be parsed.',
    'Try a different PDF or check that it is not corrupted/encrypted.',
  );

/** 422 page_range_invalid — selector out of range or malformed. */
export const pageRangeInvalidError = (): Response =>
  apiError(
    422,
    'page_range_invalid',
    'The requested page range is invalid.',
    'Use a selector like "1-5,8" and ensure pages exist in the document.',
  );

/** 422 scanned_no_text — PDF has no extractable text. */
export const scannedNoTextError = (): Response =>
  apiError(
    422,
    'scanned_no_text',
    'No extractable text was found in the selected pages.',
    'The PDF may be scanned; try an OCRed version.',
  );

/** 400 missing_file — multipart request has no file field. */
export const missingFileError = (): Response =>
  apiError(
    400,
    'missing_file',
    'No file was uploaded in the multipart request.',
    'Include a PDF file under the "file" field.',
  );
