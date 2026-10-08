import { MAX_PDF_BYTES, PDF_MAGIC } from '@/lib/errors';
import {
    fetchFailedError,
    invalidUrlError,
    notPdfError,
    tooLargeError,
} from '@/lib/error-factories';
import { ApiSuccess, ExtractOptions } from '@/lib/types';

export const runtime = 'nodejs';

/** Parse and validate the JSON request body shape. */
const parseBody = async (request: Request): Promise<Record<string, unknown> | Response> => {

    const rawJson = await request.json() as unknown;

    if (typeof rawJson !== 'object' || rawJson === null) {
        return invalidUrlError();
    }

    return rawJson as Record<string, unknown>;
};

/** Validate that a value is a valid http(s) URL string. */
const extractUrl = (value: unknown): string | Response => {

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

const checkContentLength = (response: Response): Response | null => {
    const contentLength = response.headers.get('content-length');

    const length = contentLength ? parseInt(contentLength, 10) : null;
    const parsedLength = length !== null && !Number.isNaN(length) ? length : null;

    if (parsedLength !== null && parsedLength > MAX_PDF_BYTES) {
        return tooLargeError();
    }
    return null;
}

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
        if (contentCheck instanceof Response) return contentCheck

    } catch (error) {
        console.error('Fetch failed for URL extraction:', error);
        return fetchFailedError();
    } finally {
        clearTimeout(timeoutId);
    }
}
