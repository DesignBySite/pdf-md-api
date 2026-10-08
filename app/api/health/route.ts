import { ApiSuccess } from '@/lib/types';
import { API_VERSION } from '@/lib/errors';

export const runtime = 'nodejs';

/** Return API health and version metadata. */
export async function GET(): Promise<Response> {
    const body: ApiSuccess<{ ok: true; version: string; engine: string; uptimeSec: number }> = {
        success: true,
        data: {
            ok: true,
            version: API_VERSION,
            engine: 'pdfjs-dist',
            uptimeSec: process.uptime(),
        },
    };

    return Response.json(body);
}
