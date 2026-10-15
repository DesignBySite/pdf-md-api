import { fetchFailedError, scannedNoTextError } from '@/lib/error-factories';
import { checkMagicBytes } from '@/lib/pdf/magic';
import { extractText, toPlainText } from '@/lib/pdf/text-extractor';
import { ExtractResult } from '@/lib/types';
import {
    buildExtractResponse,
    checkContentLength,
    extractUrl,
    parseBody,
    parseOptions,
    readPdfBytes,
} from './helpers';

export const runtime = 'nodejs';

/** Accept a PDF URL, validate and download it, then return a stub extraction result. */
export async function POST(request: Request): Promise<Response> {

    const body = await parseBody(request);
    if (body instanceof Response) return body;

    const url = extractUrl(body.url);
    if (url instanceof Response) return url;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
            console.log(response);

            return fetchFailedError();
        }

        const contentCheck = checkContentLength(response);
        if (contentCheck instanceof Response) return contentCheck;

        const pdfBytes = await readPdfBytes(response);
        if (pdfBytes instanceof Response) return pdfBytes;

        const magicCheck = checkMagicBytes(pdfBytes);
        if (magicCheck instanceof Response) return magicCheck;

        const options = parseOptions(body);
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
    } catch (error) {
        console.error('Fetch failed for URL extraction:', error);
        return fetchFailedError();
    } finally {
        clearTimeout(timeoutId);
    }
}
