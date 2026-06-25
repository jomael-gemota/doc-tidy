# LLM-Built SKUs with Per-Vendor Correction Learning

**Date:** 2026-06-25
**Status:** accepted
**Author:** collaborative

## Context

A user reported that Doc Tidy (production) does **not** apply their saved correction
for the **Chippewa** vendor, while corrections work for other vendors and the raw
Hermes agent honors the fix when asked directly.

Root cause (confirmed): the Chippewa correction is a **SKU-formatting** rule
(`size "7 1/2"` should yield SKU `...7.5M`, not `...71/2M`). Per
[2026-06-25-sku-extraction-learning-system.md](2026-06-25-sku-extraction-learning-system.md),
SKU assembly is **deterministic Python** (`sku.build_sku`) and corrections only
teach the LLM's *extraction*. After extraction, `worker.process_job` unconditionally
rebuilds every SKU via `enrich_line_items_with_skus` → `build_sku`, which clobbers
the corrected SKU. So a per-vendor SKU-format correction can never take effect, by
design.

**User decision (this supersedes the "deterministic assembly" decision):** the agent
(Tidy / Hermes) should *build the SKUs itself*, because SKU formats are unpredictable,
differ per vendor, and some are complicated — a single deterministic Python assembler
cannot express them. The agent must **learn each vendor's SKU format from corrections**
and **remember it permanently, per vendor/brand**.

This entry references and **supersedes** the "separate EXTRACTION from ASSEMBLY /
SKU assembly is deterministic Python" decision in the parent entry above.

## Decision

Confirmed with the user:

1. **The model builds the full `sku` per line item — including the per-vendor
   initial.** Flip `SYSTEM_PROMPT` in `worker/tidy_agent.py`: instead of "Do NOT
   build or output a SKU," instruct the model to construct each row's complete SKU,
   reproducing the vendor's established format **exactly** when reference corrections
   for that vendor are provided (same components, order, separators, and value
   transformations such as writing size `7 1/2` as `7.5`).

2. **No deterministic fallback.** Remove the deterministic SKU assembly entirely:
   delete the `enrich_line_items_with_skus` clobber from `worker.process_job` and
   retire `build_sku`/`enrich_line_items_with_skus` from `worker/sku.py`. Even a
   brand-new vendor's SKU is the model's best effort from the components; the user
   corrects it once and it is learned thereafter.

3. **Per-vendor learning via the existing correction loop.** Vendor-scoped retrieval
   (see [2026-06-25-vendor-scoped-corrections.md](2026-06-25-vendor-scoped-corrections.md))
   already injects that vendor's corrected outputs (and notes) as few-shot examples.
   With the clobber gone and the prompt flipped, the model mirrors the corrected
   `sku` values — i.e., it learns the vendor's format from the example(s).

4. **Permanence via vendor-scoped retrieval.** The format now lives entirely in
   retrieved corrections, so retrieval must surface a vendor's correction every time.
   Today `retrieve_examples` scans only the 500 most-recent corrections globally
   before partitioning by vendor; at volume a vendor's correction could fall out of
   that window and be forgotten. Fix: when the vendor is known, also issue a
   **vendor-scoped DB query** for that vendor's corrections and merge it into the
   candidate pool, so a learned format is never crowded out — remembered for that
   vendor forever, regardless of total correction volume. (No "golden pattern" pinned
   to the vendor record for now; retrieval is the single source of truth.)

5. **Vendor registration retained for scoping.** The worker still resolves the vendor
   to canonicalize the stored `vendorName` and flags unregistered vendors
   (`vendorNeedsSetup`) so the existing setup UI registers them — registration is what
   lets detection scope corrections to a vendor. `skuInitial` is no longer used for
   assembly (it becomes registration metadata; removing it from the UI/schema is
   follow-up, not part of this change).

## Alternatives Considered

| Option | Why not chosen |
|--------|----------------|
| **Keep deterministic `build_sku`, normalize the `size` component** | Fixes only the `1/2 → .5` case; cannot express the full variety of complicated, per-vendor SKU formats. Rejected by the user for this reason. |
| **Per-vendor deterministic transformation config** | Still hand-maintained Python rules per vendor; does not scale to hundreds of unpredictable formats. |
| **Keep `build_sku` as a cold-start fallback** | User chose no fallback — the model attempts every SKU and learns from the one-time correction. |
| **Pin a "golden" SKU pattern to the vendor record** | Extra surface; user chose vendor-scoped retrieval as the single permanence mechanism. |

## Consequences

- SKUs become **non-deterministic** — the model could vary or hallucinate a SKU,
  losing the "correct-by-construction" guarantee the old design provided. Mitigations:
  strong per-vendor few-shot anchoring, deterministic decoding (temperature already
  omitted), and the correction loop catches/relearns mistakes.
- Errors are no longer cleanly attributable to extraction-vs-assembly; debugging a
  bad SKU now means inspecting the prompt/examples. Accepted trade-off for flexibility.
- Reliable per-vendor retrieval is load-bearing (a forgotten correction = a forgotten
  format), addressed by the vendor-scoped query in decision 4.
- `worker/sku.py` loses its deterministic assembly helpers; the worker no longer
  depends on `skuInitial`/`skuFormat` to produce SKUs.
- Reversible: restoring the `enrich_line_items_with_skus` call and the old prompt line
  returns to deterministic assembly.

## Follow-up work

- Optionally retire `skuInitial`/`skuFormat` from the vendor setup UI + server schema,
  or repurpose the setup step into plain vendor registration.
- Update `README.md`, which still describes deterministic SKU assembly + the SKU-initial
  setup.
- Consider a lightweight notice when the model's SKU diverges from a vendor's known
  pattern, to surface drift without blocking.
