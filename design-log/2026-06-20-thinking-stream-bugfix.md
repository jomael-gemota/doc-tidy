# Fix: Reasoning Panel Not Updating

**Date:** 2026-06-20
**Status:** accepted
**Author:** ai

## Context

After the initial working implementation (see `2026-06-19-architecture.md`), the "Tidy's Reasoning"
panel on the job page was consistently blank — even when the JSON output displayed correctly.

## Root Cause

Two bugs in the thinking-persistence pipeline:

### Bug 1 — `$push` on a string field (`server/src/lib/mongodb.ts`)

`createJob` initialised the `thinking` field as an empty string `''`.
`appendThinking` then tried to `$push` a chunk onto that field.
MongoDB rejects `$push` on a non-array field with a hard error
(`The field 'thinking' must be an array but is of type string`).
Every call to `appendThinking` threw, so **thinking was never written to MongoDB**.

### Bug 2 — Unhandled error swallowed the `registry.pushToJob` call (`server/src/index.ts`)

The old ordering in the WebSocket message handler was:

```ts
await appendThinking(jobId, content)   // ← threw every time
registry.pushToJob(jobId, ...)          // ← never reached
```

Because `appendThinking` threw before `registry.pushToJob`, thinking tokens were
**also not forwarded to live SSE clients**. The JSON output still worked because
the `complete` path uses a separate code branch that never calls `appendThinking`.

## Decision

1. **`appendThinking`**: Replace the `$push` aggregation with a MongoDB aggregation-pipeline
   update using `$concat`, keeping `thinking` as an accumulated string:
   ```ts
   [{ $set: { thinking: { $concat: ['$thinking', chunk] } } }]
   ```
   This is supported in MongoDB 4.2+ (Atlas runs 7.x).

2. **`index.ts` WebSocket handler**:
   - Move `registry.pushToJob` **before** `appendThinking` so that live SSE relay
     is never blocked by a DB write.
   - Make `appendThinking` fire-and-forget (`.catch(err => console.error(...))`),
     so a transient DB error cannot drop a streaming event.
   - Wrap the entire message body in a `try/catch` to prevent unhandled promise
     rejections from crashing the server.

## Alternatives Considered

- **Store thinking as `string[]` array**: Would require changing `createJob`, the
  `JobDocument` type, and the `stream.ts` replay path. More invasive.
- **Read-then-write string concat**: Requires a fetch before every append —
  unnecessary round-trip at streaming throughput.

## Consequences

- Thinking tokens are now correctly persisted to MongoDB as a concatenated string.
- Both live-streaming clients and clients connecting to already-completed jobs will
  see the reasoning panel populate correctly.
- Existing MongoDB records that still have `thinking: ''` will replay correctly
  (empty string → falsy → no replay event sent, which is correct behaviour).
- A transient MongoDB write failure no longer crashes the server or drops SSE events.
