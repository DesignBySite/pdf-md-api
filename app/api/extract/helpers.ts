/**
 * Route-specific helpers for /api/extract.
 */

import { MAX_PDF_BYTES } from '@/lib/errors';
import {
  missingFileError,
  notPdfError,
  tooLargeError,
} from '@/lib/error-factories';

/** Parse the multipart body and extract the uploaded PDF file plus options. */
export const parseUpload = async (
  request: Request,
): Promise<{ file: File; options: unknown } | Response> => {
  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return missingFileError();
  }

  if (file.type !== 'application/pdf') {
    return notPdfError();
  }

  const rawOptions = formData.get('options');
  let options: unknown = undefined;
  if (typeof rawOptions === 'string') {
    try {
      options = JSON.parse(rawOptions) as unknown;
    } catch {
      options = undefined;
    }
  }

  return { file, options };
};

/** Read a File into a Uint8Array while enforcing the size limit. */
export const readFileBytes = async (file: File): Promise<Uint8Array | Response> => {
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_PDF_BYTES) {
    return tooLargeError();
  }
  return new Uint8Array(bytes);
};

/** Build the Phase-A stub success envelope for a validated PDF upload. */
export const buildStubResponse = (
  filename: string,
  bytesReceived: number,
  options: unknown,
): Response =>
  Response.json({
    success: true,
    data: {
      stub: true,
      filename,
      bytesReceived,
      options,
    },
  });
