import { scannedNoTextError } from '@/lib/error-factories';
import { checkMagicBytes } from '@/lib/pdf/magic';
import { extractText, toPlainText } from '@/lib/pdf/text-extractor';
import { ExtractResult } from '@/lib/types';
import {
    buildExtractResponse,
    parseOptions,
    parseUpload,
    readFileBytes,
} from './helpers';

export const runtime = 'nodejs';

/** Accept a PDF file upload, validate it, then return the extracted text. */
export async function POST(request: Request): Promise<Response> {
    const upload = await parseUpload(request);
    if (upload instanceof Response) return upload;

    const pdfBytes = await readFileBytes(upload.file);
    if (pdfBytes instanceof Response) return pdfBytes;

    const magicCheck = checkMagicBytes(pdfBytes);
    if (magicCheck instanceof Response) return magicCheck;

    const options = parseOptions(upload.options);
    const extracted = await extractText(pdfBytes, options?.pages);
    if (extracted instanceof Response) return extracted;

    if (extracted.pages.every((runs) => runs.length === 0)) {
        return scannedNoTextError();
    }

    const result: ExtractResult = {
        markdown: toPlainText(extracted),
        metadata: {
            totalPageCount: extracted.totalPageCount,
            selectedPages: extracted.pages.map((_, index) => index + 1),
        },
    };

    return buildExtractResponse(result);
}