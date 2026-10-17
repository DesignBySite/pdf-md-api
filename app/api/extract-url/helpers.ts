/**
 * Route-specific helpers for /api/extract-url.
 */

import { MAX_PDF_BYTES } from '@/lib/errors';
import {
  fetchFailedError,
  invalidUrlError,
  tooLargeError,
} from '@/lib/error-factories';
import { ExtractOptions, ExtractResult } from '@/lib/types';

/** Parse and validate the JSON request body shape. */
export const parseBody = async (request: Request): Promise<Record<string, unknown> | Response> => {
  const rawJson = await request.json() as unknown;
  if (typeof rawJson !== 'object' || rawJson === null) {
    return invalidUrlError();
  }
  return rawJson as Record<string, unknown>;
};

/** Extract the optional ExtractOptions from the raw body value. */
export const parseOptions = (raw: unknown): ExtractOptions | undefined => {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const body = raw as Record<string, unknown>;
  const options = body.options;
  if (typeof options !== 'object' || options === null) {
    return undefined;
  }
  return options as ExtractOptions;
};

/** Validate that a value is a valid http(s) URL string. */
export const extractUrl = (value: unknown): string | Response => {
  if (typeof value !== 'string') {
    return invalidUrlError();
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return invalidUrlError();
    }
    return url.href;
  } catch {
    return invalidUrlError();
  }
};

/** Reject early when Content-Length declares a payload over the limit. */
export const checkContentLength = (response: Response): Response | null => {
  const contentLength = response.headers.get('content-length');

  const length = contentLength ? parseInt(contentLength, 10) : null;
  const parsedLength = length !== null && !Number.isNaN(length) ? length : null;

  if (parsedLength !== null && parsedLength > MAX_PDF_BYTES) {
    return tooLargeError();
  }
  return null;
};

/** Read all chunks from a stream reader while enforcing the size limit. */
export const readChunks = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<{ byteChunks: Uint8Array[]; totalBytesReceived: number } | Response> => {
  const byteChunks: Uint8Array[] = [];
  let totalBytesReceived = 0;

  while (true) {
    const { done, value: byteChunk } = await reader.read();
    if (done) break;

    totalBytesReceived += byteChunk.length;
    if (totalBytesReceived > MAX_PDF_BYTES) {
      return tooLargeError();
    }
    byteChunks.push(byteChunk);
  }

  return { byteChunks, totalBytesReceived };
};

/** Concatenate a list of Uint8Array chunks into a single buffer. */
export const assembleChunks = (byteChunks: Uint8Array[], totalByteLength: number): Uint8Array => {
  const assembled = new Uint8Array(totalByteLength);
  let offset = 0;

  for (const chunk of byteChunks) {
    assembled.set(chunk, offset);
    offset += chunk.length;
  }

  return assembled;
};

/** Stream-read the response body into a Uint8Array, guarding the size limit. */
export const readPdfBytes = async (response: Response): Promise<Uint8Array | Response> => {
  const reader = response.body?.getReader();
  if (!reader) {
    return fetchFailedError();
  }

  const result = await readChunks(reader);
  if (result instanceof Response) {
    return result;
  }

  return assembleChunks(result.byteChunks, result.totalBytesReceived);
};

/** Build the success envelope for a validated PDF URL extraction. */
export const buildExtractResponse = (result: ExtractResult): Response =>
  Response.json({
    success: true,
    data: result,
  });
