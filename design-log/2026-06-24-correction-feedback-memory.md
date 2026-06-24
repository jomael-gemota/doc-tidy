# Correction Feedback Loop & Few-Shot Memory

**Date:** 2026-06-24
**Status:** proposed
**Author:** collaborative

## Context

Doc Tidy is marketed as an agent with "persistent memory that learns every day,"
but the implementation has no such mechanism. Each PDF is parsed by a fully
**stateless** call in `worker/tidy_agent.py` (`stream_tidy`): the only messages
sent are a fixed `SYSTEM_PROMPT` plus the current document text. Nothing from
prior jobs, no corrections, and no examples are included. The underlying Hermes
model has static weights, so repeated calls never improve it. The `jobs`
collection (see `server/src/lib/mongodb.ts`) and GridFS persist job history, but
that data is only ever read back for display — it never feeds the model.

Concretely, when Tidy misses fields in an uploaded PDF, the user has no way to
correct it and have the correction "stick." Re-running a job
(`resetJobForRerun`) just repeats the identical stateless call.

This entry proposes the realistic version of "learning": a **correction feedback
loop** plus **retrieval-augmented few-shot memory**. The user corrects a job's
output; corrections are stored; future similar documents inject the most relevant
corrections as in-context examples. This improves accuracy over time without
retraining or GPU fine-tuning. (Fine-tuning is explicitly out of scope here — see
Alternatives.)

Related prior context:
[2026-06-19-architecture.md](2026-06-19-architecture.md).

## Decision

### Overview

Add a closed loop with four parts:

1. **Capture** — let the user edit a completed job's `jsonOutput` and submit it as
   a correction.
2. **Store** — persist `(document signature, original output, corrected output,
   embedding)` in a new `corrections` collection.
3. **Retrieve** — for each new job, find the most similar past corrections.
4. **Inject** — prepend retrieved corrections to the parsing prompt as few-shot
   examples so the model mimics the user's preferred extraction.

```
Browser: edit JSON → POST /api/jobs/:id/correct
   ▼
Server: store correction (+ embedding) in `corrections`
   ▼
New upload → Worker.process_job
   ▼
tidy_agent.retrieve_examples(document_text)  ← top-K from `corrections`
   ▼
stream_tidy(document_text, examples)  ← examples injected as prior turns
```

### 1. Data model — new `corrections` collection

```ts
interface CorrectionDocument {
  _id?: ObjectId
  jobId: ObjectId           // job the correction came from
  filename: string
  docType?: string          // optional user/auto label (e.g. "invoice")
  documentTextSample: string // truncated source text used for matching
  embedding: number[]       // vector of documentTextSample (for similarity)
  originalOutput: Record<string, unknown> | null  // what Tidy produced
  correctedOutput: Record<string, unknown>        // what the user fixed it to
  note?: string             // optional human note ("missed tax line")
  createdAt: Date
}
```

The original PDF already lives in GridFS via the source job; corrections only
store the text sample needed for retrieval, not the full PDF again.

### 2. Capture — correction endpoint + UI

- **Server:** `POST /api/jobs/:jobId/correct` accepting `{ correctedOutput,
  note?, docType? }`. It loads the job, computes an embedding of the job's
  document text sample, and inserts a `CorrectionDocument`. Add
  `createCorrection`, `listCorrections`, and a retrieval helper to
  `server/src/lib/mongodb.ts`.
- **Client:** on the job results view, make the JSON panel editable ("Suggest a
  fix" → edit → Save). On save, POST the corrected JSON. Keep it minimal: reuse
  the existing JSON rendering, add an edit toggle and a save button.

### 3. Retrieve — similarity search

- Compute an embedding for the new document's text sample at job start.
- Score against stored correction embeddings (cosine similarity) and take top-K
  (default `CORRECTION_TOP_K=3`) above a similarity threshold
  (`CORRECTION_MIN_SCORE`, default `0.75`).
- **MVP storage:** keep embeddings in the `corrections` collection and score in
  Python (datasets are small at first). **Scale path:** migrate to MongoDB Atlas
  Vector Search once correction volume grows. Either way the retrieval interface
  (`retrieve_examples(text) -> list[Correction]`) stays stable.
- Embeddings via a small model (`EMBEDDING_MODEL`, default
  `text-embedding-3-small`), reusing the existing `OPENAI_API_KEY` already used by
  the narrator. If no key/embeddings are available, retrieval returns `[]` and
  parsing degrades gracefully to today's stateless behavior.

### 4. Inject — few-shot examples in the parse prompt

Extend `stream_tidy(document_text, examples=None)`. When examples are present,
insert them as prior user/assistant turns *before* the real document, e.g.:

```
system:    SYSTEM_PROMPT
user:      Document text: <example 1 source sample>
assistant: <thinking>…</thinking> <example 1 corrected JSON>
... (up to K examples) ...
user:      Document text: <the actual new document>
```

This teaches the model — in context, per request — how the user wants similar
documents parsed, including fields it previously missed. The worker
(`process_job`) calls `retrieve_examples` and passes the result into
`stream_tidy`. A new narration step ("checking what I've learned from your past
corrections…") surfaces the memory in the reasoning panel.

### Configuration (worker, all optional)

- `CORRECTIONS_ENABLED` — default `true`; `false` restores stateless parsing.
- `EMBEDDING_MODEL` — default `text-embedding-3-small`.
- `CORRECTION_TOP_K` — default `3`.
- `CORRECTION_MIN_SCORE` — default `0.75`.
- `CORRECTION_TEXT_SAMPLE_CHARS` — default `2000` (text used for embedding/match).

### Out of scope for this entry (noted to reduce confusion)

- The "missed details" symptom is also driven by `MAX_DOCUMENT_CHARS` (12k input
  truncation) and `MAX_TOKENS` (2048 output cap). Those are independent quick
  fixes and should be tracked separately, not conflated with "learning."

## Alternatives Considered

| Option | Why not chosen (now) |
|--------|----------------------|
| **Fine-tuning / training the model** | Truly changes weights, but expensive, periodic (not "daily"), needs hundreds of consistent examples, and complicates the local-Hermes deployment. Revisit once a large, clean correction corpus exists. |
| **Just improve the static system prompt / hard-code a field schema** | Cheapest accuracy win and still recommended, but it's global and manual — it isn't per-document "memory" and doesn't learn from user corrections. Complementary, not a substitute. |
| **Stuff all past corrections into every prompt** | Simple, but blows the context window and cost, and adds irrelevant examples. Retrieval (top-K by similarity) keeps prompts small and on-topic. |
| **Atlas Vector Search from day one** | Best at scale, but adds infra/index setup before there's enough data to justify it. Start with in-Python cosine scoring behind a stable interface; migrate later. |

## Consequences

- **Genuine improvement over time:** the more the user corrects, the more
  relevant examples future similar documents receive — the realistic form of
  "learning every day," achieved via retrieval, not retraining.
- **New moving parts:** a `corrections` collection, a correction endpoint + edit
  UI, an embedding call per job, and per-request example injection. Each is
  guarded so failure degrades to today's stateless behavior.
- **Cost:** one embedding call per job and a slightly larger parse prompt (K
  examples). Mitigated by a small embedding model, capped K, and a text sample
  (not full document) for matching.
- **Privacy:** corrected outputs and document text samples are stored; acceptable
  for an internal tool, but worth noting if data sensitivity changes.
- **Reversible:** setting `CORRECTIONS_ENABLED=false` (or omitting the embedding
  key) returns the system to its current stateless parsing with no schema removal
  required.

## Follow-up work

- Implement once accepted: schema + `mongodb.ts` helpers → correction endpoint →
  client edit/save UI → `retrieve_examples` + `stream_tidy(examples=...)` →
  narration step.
- Separately: raise/redesign `MAX_DOCUMENT_CHARS` and `MAX_TOKENS` handling, and
  consider an explicit field schema in `SYSTEM_PROMPT`.
- Future: migrate retrieval to Atlas Vector Search; add a "corrections review"
  admin view.
