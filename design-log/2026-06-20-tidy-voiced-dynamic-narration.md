# Reasoning Panel: Tidy-Voiced Dynamic Narration

**Date:** 2026-06-20
**Status:** accepted
**Author:** collaborative

## Context

Follows [2026-06-20-reasoning-pipeline-narration.md](2026-06-20-reasoning-pipeline-narration.md),
which had the worker narrate its own pipeline as plain numbered `thinking` lines
("1. Fetching PDF from storage...") so the reasoning panel always populates, even
for backends that hide their chain-of-thought.

Two issues motivated this revision:

1. **Robustness bug** — `tidy_agent.stream_tidy()` assumed every streamed chunk
   carries a non-empty `choices` array (`chunk.choices[0].delta`). OpenAI-compatible
   backends intermittently emit chunks where `choices` is `None` or `[]` (usage-only
   final frames, keep-alive frames, partial frames under load), causing
   `TypeError: 'NoneType' object is not subscriptable`. It failed on some uploads and
   succeeded on retry of the same document.
2. **Tone** — the numbered, machine-like narration reads like log output. The product
   should feel like **Tidy talking to the user** in the first person, and the phrasing
   should vary run-to-run rather than being identical boilerplate.

## Decision

### 1. Defensive streaming guard

In `stream_tidy`, skip any chunk without a usable choice/delta before indexing:

```python
if not chunk.choices:
    continue
delta = chunk.choices[0].delta
if delta is None:
    continue
```

This covers `choices is None`, `choices == []`, and `delta is None`.

### 2. Tidy-voiced narration via OpenAI

Introduce `worker/narrator.py`, a small `Narrator` that turns each pipeline event into
one short, warm, first-person line in Tidy's voice, generated with a fast OpenAI model.

- **Per-job instance** keeps a short history of prior lines so phrasing flows and Tidy
  doesn't repeat greetings.
- **Facts are passed explicitly** (filename, byte size, char count, model, elapsed) and
  the model is instructed to use them verbatim, so dynamic phrasing never invents data.
- **Fast + cheap**: small model (`NARRATION_MODEL`, default `gpt-4o-mini`), low
  `max_tokens`, short timeout (`NARRATION_TIMEOUT`).
- **Graceful fallback**: every event ships a Tidy-voiced static fallback string. If no
  OpenAI key is configured, narration is disabled, or a call errors/times out, the
  fallback is emitted. The pipeline never blocks or fails on narration.
- **Transport unchanged**: lines are still emitted as `{type: "token",
  tokenType: "thinking", content: "<line>\n"}`, reusing the existing relay, `$concat`
  persistence, and client rendering. No protocol or client changes.
- **Step-by-step layout retained**: the worker keeps the numbered, top-to-bottom
  structure from the prior entry — an intro line, then `<n>. <start>` / indented
  `<done>` pairs per stage, then a standalone completion line. The narrator supplies
  only the sentence; the worker owns numbering, indentation, and spacing.

Real model reasoning (the `reasoning_content` / `<thinking>` capture) is still streamed
inline between the "analyzing" and "parsing" narration, exactly as before.

### Configuration

New env vars (worker), all optional:

- `OPENAI_API_KEY` — real OpenAI key used only for narration. Kept separate from
  `HERMES_API_KEY` so the parsing backend can remain a local/non-OpenAI gateway.
- `NARRATION_MODEL` — default `gpt-4o-mini`.
- `NARRATION_TIMEOUT` — default `15` seconds.
- `NARRATION_ENABLED` — default `true`; set `false` to force static fallbacks.

## Alternatives Considered

- **Keep static numbered steps**: simplest, but does not meet the requested Tidy voice
  / dynamic phrasing.
- **One batched narration call up front**: cheaper and lower latency, but step text
  depends on runtime values produced mid-pipeline (sizes, counts, elapsed) and should
  stream live, so per-event generation fits the streaming panel better.
- **Reuse the Hermes parsing backend for narration**: that backend is the local gateway
  that hides reasoning and may not be a chat-friendly model; a small dedicated OpenAI
  model gives reliable, warm phrasing. Hence the separate `OPENAI_API_KEY`.

## Consequences

- The reasoning panel reads as Tidy speaking to the user, with phrasing that varies per
  run while preserving exact facts.
- Narration adds a few short, fast OpenAI calls per job (one per stage). Mitigated by a
  small model, low token cap, and short timeout; disable via `NARRATION_ENABLED=false`
  or by omitting `OPENAI_API_KEY` (falls back to static Tidy-voiced lines).
- A new optional OpenAI dependency/cost is introduced for narration only; document
  parsing is unaffected and still uses the Hermes backend.
- The streaming guard removes the intermittent `NoneType` crash class entirely.
