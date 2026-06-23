# Tabular Output Tab in Extraction Results

**Date:** 2026-06-24
**Status:** accepted
**Author:** collaborative

## Context

The Extraction Results page (`/jobs/:id`) shows a two-panel layout: the reasoning
trace (`ThinkingStream`) on the left and the structured JSON (`JsonOutput`) on the
right. The JSON panel was a single view with no tabs.

We want the output section to offer two tabs:

- **JSON** — the existing structured JSON output (unchanged behaviour).
- **Tabular** — a table rendering of the same data, produced by the Hermes agent
  from the JSON it already extracted.

Prior relevant entries:

- `2026-06-19-architecture.md` — worker → server (WS) → client (SSE) pipeline.
- `2026-06-23-job-layout-json-wider.md` — current side-by-side panel layout.
- `2026-06-20-reasoning-pipeline-narration.md` — narrated pipeline steps.

## Decision

Generate the table representation in the worker with a **second Hermes call** that
takes the extracted JSON as input and returns a normalized table structure. The
table travels through the existing pipeline alongside the JSON.

### Table data shape

A document can contain both key/value header fields and genuine line-item tables,
so the Hermes table call returns a list of tables:

```json
{
  "tables": [
    { "title": "Summary",    "columns": ["Field", "Value"], "rows": [["Invoice #", "INV-001"]] },
    { "title": "Line Items", "columns": ["Description", "Qty", "Total"], "rows": [["Widget", "2", "20.00"]] }
  ]
}
```

`tableOutput` is schema-free (`Record<string, unknown>`), consistent with how
`jsonOutput` is treated everywhere. The frontend `TableView` defensively
normalizes the shape and falls back gracefully if Hermes returns something odd.

### Pipeline changes

- **`tidy_agent.py`** — new `generate_table_data(json_data)` makes a non-streaming
  Hermes call with a dedicated table prompt and parses the result.
- **`worker.py`** — after `extract_json`, narrate a step, call
  `generate_table_data`, persist `tableOutput`, and include `table` in the
  `complete` message. Table-generation failure is non-fatal: the job still
  completes with `table: null`.
- **server `complete` handler / `mongodb.ts`** — persist `tableOutput` and include
  it in the `done` SSE event.
- **`stream.ts`** — replay `tableOutput` in the `done` event for completed jobs.
- **`useJobStream.ts`** — carry `table` in stream state.
- **UI** — new `OutputPanel` (tab bar: JSON | Tabular) wrapping `JsonView` and
  `TableView`; `JobPage` renders `OutputPanel` instead of `JsonOutput`.

The table is delivered with the completion event (not streamed token-by-token).
JSON still streams live; the Tabular tab shows a placeholder until completion.

## Alternatives Considered

- **Derive the table on the client directly from JSON** — rejected: the user
  specifically wants the Hermes agent to produce the tabular form, and arbitrary
  nested JSON does not map to a single flat table without model judgment.
- **Stream the table tokens as a third token stream** — rejected for now: adds
  parsing/relay complexity for little UX gain; a single `complete` payload keeps
  persistence and reconnect-replay trivial.
- **Separate `done` then a later `table` SSE event** — rejected: would require a
  new event type and replay path; bundling into `done` is simpler and robust.

## Consequences

- Job completion is delayed by one extra Hermes call (table generation). Acceptable
  and narrated; JSON has already streamed by then.
- New nullable `tableOutput` field on the job document; older jobs have it absent
  and the UI handles `null`.
- Re-running a job resets `tableOutput` alongside `jsonOutput`.
