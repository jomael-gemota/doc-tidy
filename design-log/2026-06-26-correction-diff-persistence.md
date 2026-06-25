# Persistent Correction Diff + Duplicate Detection

**Date:** 2026-06-26
**Status:** accepted
**Author:** collaborative

## Context

Extends `2026-06-26-correction-diff-display.md`. That change rendered the
before/after diff only in-session: the diff vanished on **page refresh** and the
"Dismiss" button **destroyed** it with no way back. Two follow-up requests:

1. The diff should be **persistent** in the UI (survive refresh, not be wiped by a
   single click).
2. Saving the **same exact correction** again should tell the user it already
   exists instead of silently storing a duplicate.

## Decision

### Persistence

- The correction document now also stores **`mode`** (`json` | `tabular`) and, for
  tabular edits, **`correctedTables`** (the edited `TableSpec[]`). These let the
  client reproduce the exact diff after a reload — a structural JSON diff of the
  stored `originalOutput` vs `correctedOutput` alone is noisy for tabular edits
  (reconstructed shape ≠ extraction schema), so the mode + tables are required.
- New endpoint **`GET /api/jobs/:id/corrections`** returns a job's corrections
  (newest-first, embedding projected out).
- `OutputPanel` fetches this on load and recomputes the diff via
  `computeCorrectionView`, so the highlight is present on a fresh page.
- **"Dismiss" → reversible show/hide toggle.** A header "Show changes / Hide
  changes" toggle plus a banner "Hide" control set a session-only `diffHidden`
  flag. Hiding never discards the correction, and a reload always shows it again.

### Duplicate detection

- `POST /api/jobs/:id/correct` canonicalizes (recursively key-sorted JSON) the
  incoming `correctedOutput` and compares it — together with the trimmed `note` —
  against existing corrections for the same job. A match on **both** the output
  and the note returns `{ ok: true, duplicate: true, correctionId }` **without
  inserting a copy**. The same output with a *different* note is a distinct
  correction (the note carries learning-loop signal worth keeping).
- The editor surfaces this: the button reads "Already saved earlier" and an inline
  note explains the exact correction already exists; the diff still displays.

## Alternatives Considered

| Option | Why not chosen |
|--------|----------------|
| **Recompute diff from stored `originalOutput`/`correctedOutput` only** | Works for JSON-mode edits but is noisy for tabular-mode edits whose corrected shape differs from the extraction schema. Storing `mode`+`correctedTables` reproduces the exact diff. |
| **Reject duplicates with a 409 error** | The intent is informational ("already exists"), not a failure. A 200 with `duplicate: true` keeps the flow smooth and still shows the diff. |
| **Persist the dismissed state server-side** | Over-engineered; hiding is a transient view preference. Session-only `diffHidden` that resets on reload matches the "keep it visible" intent. |

## Consequences

- `CorrectionDocument` gains optional `mode` / `correctedTables`. Legacy
  corrections without `mode` default to `json` (exact for JSON-mode, possibly noisy
  for old tabular ones — acceptable for pre-existing records).
- Duplicate detection is per-job and keyed on `correctedOutput` + trimmed `note`
  (`mode`/`correctedTables` ignored); editing only the note saves a new correction.
- Reversible: drop the new fields, the `GET …/corrections` route, the fetch effect,
  and the toggle to return to the in-session-only behaviour.
