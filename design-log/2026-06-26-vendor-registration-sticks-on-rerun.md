# Vendor Registration Sticks After Re-run

**Date:** 2026-06-26
**Status:** accepted
**Author:** collaborative
**Supersedes context from:** [2026-06-26-unknown-vendor-sku-setup.md](2026-06-26-unknown-vendor-sku-setup.md)

## Context

After the previous fix let users register an unrecognized vendor from the
Extraction Results page, a follow-up bug surfaced: the user adds the vendor name +
sample SKU, re-runs the document, and the **"Unrecognized vendor" card appears
again**. Two independent causes:

1. **Stale UI.** `JobPage` read `vendorName` / `vendorNeedsSetup` **once on mount**
   (`useEffect(…, [id])`). Re-run does `window.location.reload()`, so the page
   fetches the job *while it is pending* — and `resetJobForRerun` preserves the old
   pre-run vendor fields (`vendorName=null`, `vendorNeedsSetup=true`). When the new
   run finishes, the SSE stream delivers `json`/`table` but **not** the refreshed
   vendor fields, so the card kept showing the stale pre-run state.

2. **Registration didn't bind to the job.** On re-run the worker resolved only
   `extract_vendor_name(result_json) or detected_vendor`. When the model doesn't
   emit the vendor name and it isn't a substring of the raw text, resolution fails
   and the job is re-flagged — the vendor the user just registered was never
   consulted.

## Decision

1. **`JobPage` re-fetches vendor state on completion.** The job fetch now also
   depends on `status`, so when the job transitions to `completed` the card reflects
   the fresh run's `vendorName` / `vendorNeedsSetup`.

2. **Confirmed vendor is bound to the job.** `VendorSetup` calls a new
   `POST /api/jobs/:id/vendor { vendorName }` after a successful save, persisting the
   user-confirmed name onto the job (`setJobVendorName`). `resetJobForRerun` already
   preserves `vendorName`, so it survives into the re-run.

3. **Worker resolves against all candidates.** The vendor-resolution block now tries
   the extracted name, the text-detected name, **and the job's confirmed
   `vendorName`**, resolving each against registered vendors; the first match wins.
   This makes registration deterministically "stick" on re-run regardless of whether
   the model names the vendor or it appears in the document text.

## Alternatives Considered

| Option | Why not chosen |
|--------|----------------|
| **Only fix the stale UI re-fetch** | Necessary, but doesn't help when the worker genuinely can't match the registered name (model omits it / not in text) — the refreshed card would still (correctly) show unrecognized. |
| **Clear `vendorNeedsSetup` on save (before re-run)** | Would clear the badge while the document's SKUs are still the model's guesses; keeps the "register, then re-run to rebuild" semantics intact instead. |
| **Push refreshed vendor fields over the SSE stream** | Larger change to the stream contract; a targeted re-fetch on completion is simpler and localized to `JobPage`. |

## Consequences

- A job now carries the user-confirmed vendor name even before re-run; the worker
  prefers a *resolving* candidate, so a confirmed registered vendor wins over an
  unregistered extracted string.
- The "Needs SKU formats" badge still clears only after a re-run rebuilds the SKUs,
  consistent with prior design.
- Reversible: revert the `JobPage` dep, the `/vendor` route + `setJobVendorName`, the
  `VendorSetup` bind call, and the worker candidate loop.
