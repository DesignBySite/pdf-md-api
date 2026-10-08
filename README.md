# pdf-md-api

A document intelligence platform built on Next.js App Router. Currently in **v1 skeleton phase**: PDF extraction endpoints with a typed JSON envelope.

## Stack

- Next.js 16 App Router, TypeScript strict mode
- Node.js runtime (`export const runtime = 'nodejs'`)
- `pdfjs-dist` (legacy build, worker disabled) for PDF parsing

## API Contract

Every endpoint returns one of:

```json
{ "success": true, "data": { ... } }
```

or

```json
{
  "success": false,
  "error": {
    "code": "invalid_url",
    "message": "...",
    "hint": "..."
  }
}
```

Error codes: `invalid_url`, `fetch_failed`, `not_pdf`, `too_large`, `parse_failed`, `page_range_invalid`, `scanned_no_text`, `missing_file`.

## Endpoints

### `GET /api/health`

Check API status.

```bash
curl http://localhost:3000/api/health
```

Response:

```json
{
  "success": true,
  "data": {
    "ok": true,
    "version": "1.0.0",
    "engine": "pdfjs-dist",
    "uptimeSec": 12.34
  }
}
```

### `POST /api/extract-url`

Download a PDF from a URL and return a stub extraction record.

```bash
curl -X POST http://localhost:3000/api/extract-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/sample.pdf"}'
```

Options:

```json
{
  "url": "https://example.com/sample.pdf",
  "options": {
    "pages": "1-5,8",
    "structure": true,
    "includeMetadata": true
  }
}
```

Response (Phase A stub):

```json
{
  "success": true,
  "data": {
    "stub": true,
    "url": "https://example.com/sample.pdf",
    "bytesReceived": 13264,
    "options": { "structure": true }
  }
}
```

## Development

```bash
pnpm install
pnpm dev
```

The dev server runs at `http://localhost:3000`.

## Deployment

Coming in Phase E: SST/OpenNext to AWS Lambda (1024 MB, 25 s, arm64).