# Decouple Saving SKU Samples from Re-running the Job

**Date:** 2026-06-26
**Status:** accepted
**Author:** collaborative

## Context

In [2026-06-26-multiple-vendor-sku-samples.md](2026-06-26-multiple-vendor-sku-samples.md),
saving the **first** sample for a new vendor (setup mode) automatically re-ran the
current job and reloaded the page, while adding further samples (manage mode) did
not. The user wants to:

1. add **several** SKU formats up front without the page re-running/reloading after
   the first one, and
2. have re-running be a **separate, explicit** action they trigger when ready.

New documents uploaded after formats are added must still pick them up — which they
already do, because the worker reads a vendor's samples fresh on every run.

## Decision

1. **Saving a sample never re-runs.** `VendorSetup`'s save path always appends the
   sample in place (updating the list, no reload) in both setup and manage modes.
   After the first save, the card transitions from setup to manage mode in place.

2. **Re-run is a separate button.** Manage mode shows an explicit "Re-run this
   document" button that POSTs `/api/jobs/:id/rerun` and reloads onto the fresh run.
   The user adds as many formats as they want first, then re-runs once if they want
   *this* document's SKUs rebuilt with the new formats.

3. **Future uploads auto-apply (unchanged).** No code needed: the worker loads the
   vendor's `skuSamples` before extraction on every job, so any document processed
   after the formats are saved uses them automatically. Re-run only exists to
   rebuild a document that was already parsed before the formats existed.

This supersedes decision #4's "setup mode re-runs on first save" from
2026-06-26-multiple-vendor-sku-samples.md.

## Alternatives Considered

| Option | Why not chosen |
|--------|----------------|
| **Keep auto-rerun on first save** | Forces a reload mid-setup and prevents adding multiple formats before reprocessing — the opposite of what the user wants. |
| **Auto-rerun after every save (debounced)** | Wasteful and surprising; the user wants explicit control over reprocessing. |
| **Re-run automatically only when leaving the page** | Hidden, hard to reason about; an explicit button is clearer. |

## Consequences

- A freshly set-up document keeps its original best-guess SKUs until the user clicks
  Re-run; this is now an explicit, predictable choice.
- Adding/removing formats is fast and non-disruptive (in place, no reload).
- Reversible: restore the first-save rerun branch.
