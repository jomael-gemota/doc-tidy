# Excel Export for Extraction Results

**Date:** 2026-06-24
**Status:** accepted
**Author:** collaborative

## Context

The Hermes/Tidy agent now produces both JSON output and tabular data (`tableOutput`) for
processed PDFs. Currently the only way to get data out of the UI is the Copy button in
`OutputPanel.tsx`, which copies either raw JSON or GitHub-flavoured markdown to the clipboard.

Users need a proper file download — specifically an `.xlsx` Excel file — so they can open
results directly in Excel or import them into other tools.

## Decision

Add client-side Excel generation using **SheetJS (`xlsx`)**, the most widely adopted
browser-compatible Excel library. No server changes are required because all data needed
for export is already available in the browser.

Two entry points for the download:

1. **Document Batches table** (`BatchTable.tsx`) — a new "Download Result" `IconBtn` in the
   Actions column, visible for every row but disabled unless the batch is `completed`. On
   click, it fetches the full job document (`GET /api/jobs/:id`) to retrieve `tableOutput`
   (not included in the batch list response), then triggers a `.xlsx` download.

2. **Job page** (`OutputPanel.tsx`) — a matching icon button placed beside the existing
   Copy button. Data is already in component state via props so no fetch is needed.

Excel file layout:
- Each `TableSpec` (title + columns + rows) becomes a **separate sheet** named after the
  table title (truncated to 31 chars, Excel's sheet-name limit).
- Sheet names fall back to `Sheet1`, `Sheet2`, … when no title is present.
- Duplicate sheet names get a numeric suffix.
- The file is named `<filename>-results.xlsx` (or `results.xlsx` as a fallback).

Icon: `FileSpreadsheet` from `lucide-react`, coloured green (`#16a34a`) to match the
Excel brand colour convention, consistent with the completed-status colour already used in
`BatchTable.tsx`.

## Alternatives Considered

- **Server-side generation with `openpyxl`**: avoids shipping `xlsx` to the browser but
  adds a new API endpoint, a Python dependency, and requires storing or re-generating the
  file. Rejected in favour of keeping this stateless on the client.
- **CSV download**: simpler but loses multi-sheet grouping and can't represent multiple
  tables cleanly. Not mutually exclusive — can be added later.
- **Including `tableOutput` in the batch list response**: would avoid the on-demand fetch
  in `BatchTable` but increases list payload significantly for completed jobs. Rejected.

## Consequences

- `xlsx` (~900 KB unpacked, ~200 KB gzipped) is added to the client bundle. Acceptable
  for an internal tool.
- `tableData.ts` gains a new `tablesToExcel(tables, filename)` function that is
  tree-shaken away if unused.
- `Batch` type / `useBatches` hook are unchanged; the table download in `BatchTable`
  fetches job data on demand.
