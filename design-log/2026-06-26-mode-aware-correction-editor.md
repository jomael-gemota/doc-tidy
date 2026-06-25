# Mode-Aware Correction Editor (tabular vs. JSON)

**Date:** 2026-06-26
**Status:** accepted
**Author:** collaborative

## Context

The "Suggest a fix" flow on the extraction results page
(`client/src/components/OutputPanel.tsx` → `CorrectionEditor.tsx`) always drops
the user into a single plain `<textarea>` of raw JSON, regardless of which view
they were looking at. Two problems:

1. **View/edit mismatch.** A user reviewing the **Tabular** view who spots a wrong
   cell is forced to hunt for that value inside raw JSON. The edit surface should
   match the view they invoked the fix from.
2. **Bare editing affordances.** The JSON editor is an unstyled textarea (no line
   numbers, no syntax colors, no tab handling) and the correction *note* is a
   single-line `<input>`, which is cramped for the prompt-style guidance users
   actually write ("Qty comes from the Units column, not the pack count…").

The correction API (`POST /api/jobs/:id/correct`) is unchanged: it stores a
`correctedOutput` JSON object plus an optional `note`, embeds the source text, and
feeds both back into the learning loop as a few-shot example.

## Decision

1. **The editor mode follows the active tab.** `OutputPanel` passes its current
   tab (`tabular` | `json`) into `CorrectionEditor`:
   - **Tabular view → editable grid.** The user edits table cells in place
     (`TableEditor`), with add/remove row controls. On save, the edited tables are
     reconstructed into a JSON object (`tablesToJson`) and sent as `correctedOutput`.
   - **JSON view → code editor.** The user edits in a lightweight VS Code–style
     editor (`JsonCodeEditor`): a line-number gutter, live syntax highlighting,
     monospace layout, `Tab`-inserts-spaces, horizontal scroll, and a live
     valid/invalid indicator. The parsed object is sent as `correctedOutput`.

2. **No new heavy dependencies.** The code editor is built from a transparent
   `<textarea>` layered over a scroll-synced highlighted `<pre>` overlay, reusing
   the existing token colors in `lib/jsonHighlight`. A small regex tokenizer
   (`highlightJson`) colors *raw, possibly-invalid* text as the user types (the
   existing `renderJsonValue` only works on already-parsed values). This keeps the
   bundle lean (no CodeMirror/Monaco) for what is a small editing surface.

3. **The note becomes a prompt-style textarea.** Replace the single-line note input
   with a taller multi-line `<textarea>` (labelled, with a descriptive placeholder)
   so the user can write natural-language guidance comfortably.

4. **`tablesToJson` reconstruction rules.** Field/Value summary tables become
   top-level key/value pairs; multi-column tables (e.g. Line Items) become an array
   of row objects keyed by column name under a camelCased key derived from the
   table title; single-column lists become an array of values. Cell text is lightly
   coerced (numbers, booleans, null) so corrected quantities stay numeric.

## Alternatives Considered

| Option | Why not chosen |
|--------|----------------|
| **Keep JSON-only editing** | Ignores the user's request and the view/edit mismatch; tabular reviewers must translate cells to JSON by hand. |
| **Adopt Monaco/CodeMirror for the JSON editor** | Heavyweight for a small, occasional editing surface; adds bundle size and config. The textarea+overlay technique gives the VS Code feel at a fraction of the cost. |
| **Persist the table shape itself as `correctedOutput`** | The learning loop expects an extraction-shaped JSON object; reconstructing one from the edited tables keeps corrections coherent without changing the API or worker. |
| **Map table edits back onto the original extraction JSON** | The Hermes-generated table is a reorganization with no guaranteed 1:1 path back to the source JSON; reconstructing a fresh object from the edited tables is simpler and predictable. |

## Consequences

- Corrections made from the tabular view are stored as a JSON object reconstructed
  from the table (keys derived from column/title names), which may differ in shape
  from the original extraction schema. Acceptable: the few-shot example still
  conveys the corrected field choices, and JSON-view edits preserve the exact schema.
- The hand-rolled code editor must keep the overlay and textarea metrics identical
  (font, padding, line-height, `white-space: pre`); a mismatch would misalign the
  highlight. Documented in the component.
- Reversible: revert `CorrectionEditor` to the single textarea and drop the new
  components/helpers.

## Follow-up work

- Optional: inline per-cell validation (e.g. numeric qty) in the table editor.
- Optional: collapse/format ("prettify") button in the JSON editor.
