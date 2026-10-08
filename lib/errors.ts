/**
 * Standard API error helper and global constants for pdf-md-api.
 *
 * All route handlers should construct failures through apiError() so the
 * response body always matches the ApiResponse<never> contract and stack
 * traces are never leaked to clients.
 */

import { ApiErrorCode, ApiFailure } from '@/lib/types';

/** Current API version returned by /api/health. */
export const API_VERSION = '1.0.0';

/** Hard upper bound for uploaded / fetched PDF payloads (25 MB). */
export const MAX_PDF_BYTES = 25 * 1024 * 1024;

/** Magic bytes every PDF file must begin with. */
export const PDF_MAGIC = '%PDF-';

/** Build a typed JSON error Response. */
export const apiError = (
	status: number,
	code: ApiErrorCode,
	message: string,
	hint: string,
): Response => {
	const body: ApiFailure = {
		success: false,
		error: { code, message, hint },
	};

	return Response.json(body, { status });
};
