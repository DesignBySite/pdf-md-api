import {
    checkContentLength,
    checkMagicBytes,
    readPdfBytes,
    parseBody,
    extractUrl,
    buildStubResponse
} from '@/lib/pdf/fetch-helpers';

import { fetchFailedError } from '@/lib/error-factories';

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
            return fetchFailedError();
        }

        const contentCheck = checkContentLength(response);
        if (contentCheck instanceof Response) return contentCheck;

        const pdfBytes = await readPdfBytes(response);
        if (pdfBytes instanceof Response) return pdfBytes;

        const magicCheck = checkMagicBytes(pdfBytes);
        if (magicCheck instanceof Response) return magicCheck;

        return buildStubResponse(url, pdfBytes.length, body.options);
    } catch (error) {
        console.error('Fetch failed for URL extraction:', error);
        return fetchFailedError();
    } finally {
        clearTimeout(timeoutId);
    }
}
