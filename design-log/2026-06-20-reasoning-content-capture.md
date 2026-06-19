# Fix: Reasoning Panel Still Blank — Capture `reasoning_content`

**Date:** 2026-06-20
**Status:** accepted
**Author:** ai

## Context

Follows [2026-06-20-thinking-stream-bugfix.md](2026-06-20-thinking-stream-bugfix.md), which fixed
the `$push`-on-a-string persistence bug and the WebSocket relay ordering. Despite that fix, the
"Tidy's Reasoning" panel was *still* blank while the JSON output panel populated correctly.

## Root Cause

The earlier fix repaired the *persistence and relay* of thinking tokens, but the worker was never
**producing** any thinking tokens to begin with.

`tidy_agent.stream_tidy()` only read `chunk.choices[0].delta.content` and relied on the model
wrapping its chain-of-thought in `<thinking>…</thinking>` tags inside that `content` field.

The configured backends are **reasoning models** (GPT-5.5 / Hermes thinking — see
`2026-06-19-architecture.md`). Reasoning models do **not** emit their chain-of-thought inside
`<thinking>` tags in `content`. Instead, the OpenAI-compatible streaming API delivers it in a
separate delta field — `reasoning_content` (and some backends use `reasoning`). The `content`
field carries only the final answer (the JSON object).

Consequently:

- `delta.content` → JSON only → parsed and shown in the **JSON Output** panel (worked).
- The chain-of-thought in `delta.reasoning_content` was **ignored entirely** → no `thinking`
  tokens were ever emitted → relayed → persisted, so the **Reasoning** panel stayed blank.

This is why the previous persistence fix had no visible effect: there was no thinking data
flowing into the pipeline it repaired.

## Decision

In `worker/tidy_agent.py`, read the reasoning delta in addition to `content`:

- For each streamed chunk, surface `delta.reasoning_content` (falling back to `delta.reasoning`,
  and to `delta.model_extra` for SDK versions that stash unknown fields there) directly as a
  `THINKING` chunk.
- Keep the existing `<thinking>`-tag parser for `content`. This preserves backward compatibility
  with non-reasoning models that follow the system prompt and inline `<thinking>` tags. When
  reasoning arrives out-of-band, `content` holds only JSON, which the existing parser correctly
  classifies as `OUTPUT`.

The server relay and MongoDB persistence are unchanged — they already handle `thinking` tokens
correctly after the prior fix.

## Alternatives Considered

- **Force the model to inline `<thinking>` via prompt only**: Unreliable — reasoning models route
  chain-of-thought to a dedicated channel regardless of prompt instructions, and some hide it.
- **Switch backends to a non-reasoning model**: Changes product behaviour and is environment
  specific; the worker should support both model families.

## Consequences

- The reasoning panel now populates for reasoning models (the configured default) as well as
  models that inline `<thinking>` tags.
- Reasoning tokens are persisted via the existing `$concat` path, so completed-job reloads replay
  the full reasoning.
- If a model emits reasoning in *both* `reasoning_content` and inline `<thinking>` tags (uncommon),
  thinking could appear twice; acceptable and non-fatal.
