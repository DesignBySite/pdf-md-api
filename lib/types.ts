/**
 * Shared domain types and API response envelope for pdf-md-api.
 *
 * Every API route must return an ApiResponse<T> so the TypeScript compiler
 * guarantees the success/error envelope shape.
 */

/** Recognized API error codes returned in failure envelopes. */
export type ApiErrorCode =
  | 'invalid_url'
  | 'invalid_json'
  | 'fetch_failed'
  | 'not_pdf'
  | 'too_large'
  | 'parse_failed'
  | 'page_range_invalid'
  | 'scanned_no_text'
  | 'missing_file';

/** Successful API response envelope. */
export type ApiSuccess<T> = {
  success: true;
  data: T;
};

/** Failed API response envelope. */
export type ApiFailure = {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    hint: string;
  };
};

/** Discriminated union returned by every API route. */
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** Options accepted by PDF extraction endpoints. */
export type ExtractOptions = {
  pages?: string;
  structure?: boolean;
  includeMetadata?: boolean;
};

/** Result payload returned by the v1 extraction endpoints. */
export type ExtractResult = {
  markdown: string;
  metadata?: {
    totalPageCount: number;
    selectedPages: number[];
    bodyFontSize?: number;
  };
};
