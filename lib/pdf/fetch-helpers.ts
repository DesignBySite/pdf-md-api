import { MAX_PDF_BYTES, PDF_MAGIC } from '@/lib/errors';
import {
  fetchFailedError,
  notPdfError,
  tooLargeError,
  invalidUrlError
} from '@/lib/error-factories';

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
): Promise<{
  byteChunks: Uint8Array[];
  totalBytesReceived: number
} | Response> => {
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

/** Verify the downloaded bytes start with the PDF magic signature. */
export const checkMagicBytes = (pdfBytes: Uint8Array): Response | null => {
  const magic = new TextDecoder().decode(pdfBytes.slice(0, PDF_MAGIC.length));

  if (magic !== PDF_MAGIC) {
    return notPdfError();
  }

  return null;
};

/** Parse and validate the JSON request body shape. */
export const parseBody = async (request: Request): Promise<Record<string, unknown> | Response> => {

  const rawJson = await request.json() as unknown;

  if (typeof rawJson !== 'object' || rawJson === null) {
    return invalidUrlError();
  }

  return rawJson as Record<string, unknown>;
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

/** Build the Phase-A stub success envelope for a validated PDF URL. */
export const buildStubResponse = (url: string, bytesReceived: number, options: unknown): Response => {
  return Response.json({
    success: true,
    data: {
      stub: true,
      url,
      bytesReceived,
      options,
    },
  });
};