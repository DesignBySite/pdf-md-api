/**
 * Route-specific helpers for /api/extract.
 */

import { MAX_PDF_BYTES } from '@/lib/errors';
import {
  missingFileError,
  notPdfError,
  tooLargeError,
} from '@/lib/error-factories';
import { ExtractOptions, ExtractResult } from '@/lib/types';

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

/** Build the success envelope for a validated PDF file extraction. */
export const buildExtractResponse = (result: ExtractResult): Response =>
  Response.json({
    success: true,
    data: result,
  });

/** Cast the raw options field into ExtractOptions if present. */
export const parseOptions = (raw: unknown): ExtractOptions | undefined => {
  if (typeof raw !== 'string') {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as ExtractOptions;
    }
  } catch {
    // ignore malformed options JSON
  }
  return undefined;
};
