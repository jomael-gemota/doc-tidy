# Correction Diff Display (before → after)

**Date:** 2026-06-26
**Status:** accepted
**Author:** collaborative

## Context

When a user clicks **Save correction** in the "Suggest a fix" flow
(`CorrectionEditor`), the editor closes and both output tabs go back to showing
the *original* extraction as if nothing happened. The user gets no visual
confirmation of **what** they changed.

Requested behaviour: after saving, the output should distinguish the corrected
parts from the original — e.g. for `vendorName` changing from `"Justin Boot"` to
`"Justin"`, show the original value struck through next to the new value in bold
(`~~Justin Boot~~ → **Justin**`). This must work in **both** the Tabular and JSON
views.

Builds on `2026-06-26-mode-aware-correction-editor.md` (the mode-aware editor that
produces the `correctedOutput`).

## Decision

1. **Client-side, in-session diff.** No server/schema change. After a successful
   save, `CorrectionEditor` hands the corrected payload back to `OutputPanel` via
   an `onSaved` callback. `OutputPanel` already holds the original `json`/`table`,
   so it computes a diff and renders it in both views until the user dismisses it.

2. **One diff model, two render targets** (`lib/correctionDiff.tsx`):
   - **JSON view** renders a recursive `DiffNode` tree (object/array/leaf). Leaves
     are `unchanged | changed | added | removed`; changed leaves render
     `~~before~~ → **after**`.
   - **Table view** renders a `TableDiffSpec[]` (rows aligned by index, per-cell
     status) with the same inline decoration; whole-row add/remove is supported.

3. **Exact diff for the edited view, value-match projection for the other.**
   A correction is made in exactly one representation, so:
   - **JSON-mode edit** → exact structural diff (`diffJson`) for the JSON view; the
     scalar changes are projected onto table cells by matching cell *text*
     (`buildTableDiffFromValueMatches`).
   - **Tabular-mode edit** → exact index-aligned cell diff (`buildTableDiff`) for
     the Table view; the cell changes are projected onto JSON leaves by value
     (`diffJsonByValueMatches`).
   This keeps the view the user edited precise, while still reflecting the change
   in the other tab so "both views" stay consistent when the user switches tabs.

4. **Dismissable banner.** `OutputPanel` shows a small banner ("Showing your saved
   correction — N change(s)…") with a Dismiss action that clears the diff and
   returns to the plain output.

## Alternatives Considered

| Option | Why not chosen |
|--------|----------------|
| **Persist + refetch the diff from the stored correction** | The server already stores `originalOutput` + `correctedOutput`, but the request is about immediate post-save feedback. In-session display is simpler and avoids a new read path; can be added later. |
| **Full structural diff across representations** | Tabular corrections are reconstructed into a JSON shape (`tablesToJson`) that doesn't match the original extraction schema, so a structural JSON diff would report everything as changed. Value-match projection avoids that noise. |
| **Only diff the view that was edited** | Leaves the other tab stale/inconsistent. Value-match projection is a small, bounded addition that keeps both tabs in sync. |

## Consequences

- **Value-match projection is fuzzy.** If the same scalar text appears in multiple
  places in the *other* view, all occurrences are decorated. Acceptable for this
  internal tool; the edited view is always exact. Empty/whitespace values are not
  matched.
- Added/removed JSON subtrees render as a single decorated blob rather than a fully
  expanded tree — fine for the common case (scalar field edits).
- Reversible: drop `lib/correctionDiff.tsx`, the `diff`/`onSaved` props, and the
  banner to return to plain post-save behaviour.
