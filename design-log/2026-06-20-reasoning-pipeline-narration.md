# Reasoning Panel: Worker-Emitted Pipeline Narration

**Date:** 2026-06-20
**Status:** accepted
**Author:** collaborative

## Context

Follows [2026-06-20-reasoning-content-capture.md](2026-06-20-reasoning-content-capture.md).
After adding `reasoning_content` capture, the "Tidy's Reasoning" panel was *still* empty in the
deployed app.

Investigation (this session):

- Verified the `$concat` thinking-persistence works against MongoDB Atlas (probe script: two
  sequential pipeline updates concatenated correctly, no null propagation).
- Verified the SSE relay (`worker-registry.pushToJob`) and the client `thinking` event handler
  are correct.
- Confirmed the configured backend is the Hermes Agent gateway (`HERMES_MODEL=hermes-agent` at
  `http://localhost:8642/v1`).

Conclusion: the pipeline that carries thinking tokens is healthy. The panel is blank because the
gateway returns only the final JSON answer — it exposes **no** chain-of-thought, neither as
`<thinking>` tags in `content` nor as a `reasoning_content` delta. There is simply nothing to show.

The user wants the panel to display the processing as a **step-by-step pipeline, top to bottom**,
regardless of whether the model surfaces its own reasoning.

## Decision

Have the **worker narrate its own processing pipeline** as `thinking` tokens, emitted at each
stage of `worker.py:process_job`:

1. Document received (filename)
2. Fetching PDF from storage → size retrieved
3. Extracting text → character count
4. Sending document to Tidy (model name)
5. Tidy analyzing → live model reasoning streamed inline when available; otherwise a short note
   that the model returned a direct answer
6. Parsing structured output → valid JSON
7. Completed (elapsed seconds)

Implementation notes:

- A `step()` helper sends `{type: "token", tokenType: "thinking", content: "<line>\n"}`. This
  reuses the **existing** relay + `$concat` persistence + client rendering with no protocol or
  client changes — steps stream live, persist to MongoDB, and replay on reload like any thinking.
- Real model reasoning (from the `reasoning_content` capture / `<thinking>` parser) is still
  streamed inline between the "analyzing" and "parsing" steps, so genuine chain-of-thought (when a
  backend provides it) appears within the pipeline.
- Errors append a final failure line so the panel reflects what happened.

## Alternatives Considered

- **New structured `step` SSE event + client stepper component**: nicer visuals, but requires
  changes to the server relay, client hook, a new component, and the persistence/replay path.
  Higher risk for marginal benefit; can be a follow-up.
- **Prompt the model harder for `<thinking>`**: unreliable — the gateway strips/hides reasoning
  regardless of prompt.
- **Leave the panel empty when no reasoning**: poor UX; the user explicitly wants visible progress.

## Consequences

- The reasoning panel always populates with a readable top-to-bottom pipeline, even for backends
  that hide their reasoning.
- Narration is plain ASCII (numbered steps), so it renders cleanly in the monospace panel and
  persists/replays correctly.
- Live progress is now visible during processing rather than only at completion.
- If a backend *does* expose reasoning, it appears inline within the pipeline (steps + reasoning).
