# Vendor-Scoped Correction Retrieval

**Date:** 2026-06-25
**Status:** accepted
**Author:** collaborative

## Context

Extends [2026-06-25-sku-extraction-learning-system.md](2026-06-25-sku-extraction-learning-system.md),
whose Phase 4 specified retrieval "filtered by `vendorId` first, then by embedding
similarity." That filtering was never actually wired up:

- `corrections.retrieve_examples()` accepted a `vendor_name` and applied a soft
  `+0.05` boost, but `worker.py` called it **without** a vendor, so the boost
  never fired.
- More fundamentally, retrieval runs **before** extraction, while the vendor
  name was only discovered **after** extraction (`extract_vendor_name(result_json)`).
  So at retrieval time the pipeline had no vendor to scope by.

Result: a correction from Vendor A could surface (purely on embedding
similarity) for Vendor B's document, and same-vendor fixes were not prioritized.
The user asked to "make sure corrections are vendor-based."

## Decision

1. **Detect the vendor from RAW text before retrieval.** New
   `sku.detect_vendor_name_from_text(db, document_text)` scans the extracted
   text for any **registered** vendor's name (normalized, longest-match wins).
   Cheap (no extra LLM call) and leverages the one-time vendor setup. Returns
   the vendor's canonical name, or `None` when no registered vendor is found.

2. **Scope retrieval strictly to the detected vendor.**
   `retrieve_examples(db, document_text, vendor_name)` now partitions candidates
   by normalized vendor name:
   - **Vendor known + has corrections** → return only that vendor's corrections
     (ranked by similarity). No cross-vendor leakage.
   - **Vendor known + no corrections** → return `[]` when
     `CORRECTION_VENDOR_STRICT` (default `true`); otherwise fall back to global
     similarity.
   - **Vendor unknown** (new/unregistered) → global similarity (best-effort cold
     start, unchanged behavior).
   The old soft `+0.05` boost is removed in favor of this hard partition.

3. **Store the canonical vendor name on jobs/corrections.** When the worker
   resolves a vendor record, it persists `vendor["name"]` (canonical) rather than
   the raw per-document spelling, so the stored correction's vendor key
   normalizes to the same value detection produces. Vendor matching stays in
   Python via the shared `normalize_vendor_name` (lowercase + whitespace
   collapse), so no schema migration or backfill is required.

## Alternatives Considered

| Option | Why not chosen |
|--------|----------------|
| **Extract vendor with a cheap pre-pass LLM call** | Adds latency/cost per job; raw-text match against registered vendors is sufficient given one-time setup. |
| **Keep the soft +0.05 boost** | Does not prevent cross-vendor leakage; a high-similarity other-vendor correction still wins. |
| **Strict filter even when vendor unknown (return [])** | Would regress the current cold-start behavior for unregistered vendors. Gated behind `CORRECTION_VENDOR_STRICT` instead. |
| **Add a normalized vendor field server-side + backfill** | Heavier; Python-side normalization over the candidate set is faithful to the existing MVP retrieval and avoids migration. |

## Consequences

- Corrections now reliably apply to the **right** vendor and never leak across
  vendors once a vendor is registered and detectable.
- Detection only covers **registered** vendors; unregistered vendors fall back to
  global similarity. Acceptable — corrections matter most for known vendors.
- Vendor matching depends on the registered name literally appearing in the
  document text. If a vendor's printed name varies wildly from its registered
  name, detection misses and we fall back to global similarity (no regression).
- New config: `CORRECTION_VENDOR_STRICT` (default `true`).
- Reversible: set `CORRECTION_VENDOR_STRICT=false` to restore similarity-only
  fallback when a known vendor has no corrections yet.

## Follow-up work

- Consider persisting a normalized vendor key + MongoDB Atlas `$vectorSearch`
  with a vendor `filter` once correction volume grows (per the parent entry).
- Layout/header signature as a backup vendor identifier when the name is absent
  or inconsistent.
