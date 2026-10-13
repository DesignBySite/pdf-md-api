/**
 * Shared PDF magic-byte verification helper.
 */

import { PDF_MAGIC } from '@/lib/errors';
import { notPdfError } from '@/lib/error-factories';

/** Verify the downloaded bytes start with the PDF magic signature. */
export const checkMagicBytes = (pdfBytes: Uint8Array): Response | null => {
  const magic = new TextDecoder().decode(pdfBytes.slice(0, PDF_MAGIC.length));

  if (magic !== PDF_MAGIC) {
    return notPdfError();
  }

  return null;
};
