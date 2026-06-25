# Multiple Sample SKUs per Vendor + Persistent Manager

**Date:** 2026-06-26
**Status:** accepted
**Author:** collaborative

## Context

[2026-06-26-vendor-setup-sample-sku.md](2026-06-26-vendor-setup-sample-sku.md)
added a one-time setup where the user pastes a single sample SKU
(`vendors.skuSample`) that Tidy uses as a per-vendor format anchor. Two issues
surfaced in use:

1. **The setup card lingers after setup.** `JobPage` renders `VendorSetup` only
   when `vendorNeedsSetup` is true, but `resetJobForRerun` does not clear that
   flag and `JobPage` reads the job once on mount, so after saving + re-running
   the prominent orange "New vendor" card with an empty input stays on screen
   (it reflects stale data), which is confusing.
2. **One sample isn't enough.** A vendor can legitimately use **multiple** SKU
   formats (e.g. different product lines or size/width variants). The single
   `skuSample` field can't capture that.

The user asked: don't remove the field after setup — instead, once a sample is
saved, collapse it into a link the user can click to add **another** sample SKU.

## Decision

1. **A vendor stores a list of sample SKUs.** Replace the single
   `vendors.skuSample` with `vendors.skuSamples: string[]`. The legacy
   `skuSample` (if present on older records) is still read as an additional
   sample for backward compatibility; nothing writes it anymore.

2. **Adding a sample appends (deduplicated).** `POST /api/vendors` keeps the
   `{ name, skuSample }` request shape (the client submits one sample at a time)
   but the server **appends** it to `skuSamples` via `$addToSet`, creating the
   vendor on first add. (Renamed helper: `addVendorSkuSample`.)

3. **All samples are injected as the format anchor.** The worker passes every
   known sample (`skuSamples` + legacy `skuSample`) to `stream_tidy`, and
   `_build_vendor_format_anchor` lists them, instructing the model to build each
   row's SKU to match whichever example fits that row. Corrections still win on
   conflict.

4. **The card becomes a persistent, mode-aware manager** (`VendorSetup`), shown
   on any completed job that has a `vendorName`:
   - **Setup mode** (vendor has no samples yet): the prominent orange card with
     the sample input and *Save & learn format*, which appends the sample, then
     re-runs the job so this document's SKUs rebuild with the learned format
     (unchanged behavior for new vendors).
   - **Manage mode** (vendor already has ≥1 sample): a subtler card that lists the
     saved sample(s) and shows an *Add another sample SKU* link. Clicking it
     reveals the input; saving appends the new sample and refreshes the list
     in place (no full re-run/reload — the current document is already parsed and
     the new format is for future/other documents).

   The component fetches `GET /api/vendors/:name` on mount to decide its mode and
   to render existing samples, so it is correct regardless of the (possibly
   stale) `vendorNeedsSetup` flag on the job.

## Alternatives Considered

| Option | Why not chosen |
|--------|----------------|
| **Just fix the stale flag so the card disappears** | Solves the lingering card but not the "add another format" need the user asked for. |
| **Keep a single sample, overwrite on edit** | Can't represent vendors with genuinely different SKU formats. |
| **Re-run the job on every added sample** | Wasteful for manage-mode additions that target other documents; the first setup still re-runs because its SKUs were best-guesses. |
| **Free-form multiline textarea of samples** | Harder to display/edit individual entries and to dedupe; discrete entries with an explicit "add" affordance match the requested UX. |

## Consequences

- Vendor records grow a small `skuSamples` array. The format anchor prompt grows
  with the number of samples; this is bounded in practice (a handful per vendor).
- `VendorSetup` now appears (in its subtle manage form) for completed jobs whose
  vendor is registered, not only brand-new vendors — intentional, so users can add
  formats anytime.
- Reading must tolerate both `skuSamples` and legacy `skuSample`; writing only
  touches `skuSamples`.
- Reversible: collapse `skuSamples` back to a single value and restore the
  `vendorNeedsSetup`-only render gate.

## Follow-up work

- Optional: allow removing/editing an individual saved sample.
- Optional: clear `vendorNeedsSetup` in `resetJobForRerun` (or refetch the job
  when the stream completes) so the job document is self-consistent.
