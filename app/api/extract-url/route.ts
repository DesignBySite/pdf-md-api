import {
    apiError,
    MAX_PDF_BYTES, PDF_MAGIC
} from '@/lib/errors';
import { ApiSuccess, ExtractOptions } from '@/lib/types';

export const runtime = 'nodejs';

/** Parse and validate the JSON request body shape. */
const parseBody = async (request: Request): Promise<Record<string, unknown> | null> => {
    const rawJson = await request.json() as unknown;
    if (typeof rawJson !== 'object' || rawJson === null) return null;
    return rawJson as Record<string, unknown>;
};

/** Validate that a value is a valid http(s) URL string. */
const extractUrl = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    try {
        const url = new URL(value);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        return url.href;
    } catch {
        return null;
    }
};

/** Accept a PDF URL, validate and download it, then return a stub extraction result. */
export async function POST(request: Request): Promise<Response> {
    const body = await parseBody(request);
    if (!body) {
        return apiError(
            400,
            'invalid_url',
            'Request body must be a JSON object.',
            'Send { "url": "https://example.com/file.pdf" }.',
        );
    }

    const url = extractUrl(body.url);
    if (!url) {
        return apiError(
            400,
            'invalid_url',
            'url is required and must be a valid http:// or https:// URL.',
            'Check the URL scheme and try again.',
        );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
            return apiError(
                502,
                'fetch_failed',
                `Upstream returned status ${response.status}.`,
                'Verify the URL points to an accessible PDF.',
            );
        }

        // TODO: validate Content-Length, stream-read with size guard, magic check, return stub
    } catch (error) {
        console.error('Fetch failed for URL extraction:', error);
        return apiError(
            502,
            'fetch_failed',
            'Could not fetch the URL within 10 seconds or the upstream refused the connection.',
            'Ensure the URL is reachable and returns a PDF quickly.',
        );
    } finally {
        clearTimeout(timeoutId);
    }
}
