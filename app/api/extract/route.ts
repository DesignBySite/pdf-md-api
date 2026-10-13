import { checkMagicBytes } from '@/lib/pdf/magic';
import {
    parseUpload,
    readFileBytes,
    buildStubResponse,
} from './helpers';

export const runtime = 'nodejs';

/** Accept a PDF file upload, validate it, then return a stub extraction result. */
export async function POST(request: Request): Promise<Response> {
    const upload = await parseUpload(request);
    if (upload instanceof Response) return upload;

    const pdfBytes = await readFileBytes(upload.file);
    if (pdfBytes instanceof Response) return pdfBytes;

    const magicCheck = checkMagicBytes(pdfBytes);
    if (magicCheck instanceof Response) return magicCheck;

    return buildStubResponse(upload.file.name, pdfBytes.length, upload.options);
}