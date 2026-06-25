# Removing Vendor SKU Samples

**Date:** 2026-06-26
**Status:** accepted
**Author:** collaborative

## Context

[2026-06-26-multiple-vendor-sku-samples.md](2026-06-26-multiple-vendor-sku-samples.md)
let a vendor accumulate multiple sample SKUs and listed "allow removing/editing an
individual saved sample" as follow-up work. The user asked for the removal half:
delete a previously added SKU format, and have that propagate to Tidy (the Hermes
agent) so it stops using the removed format for that vendor.

## Decision

1. **Removal is a vendor-record edit.** Tidy holds no separate per-vendor memory:
   the worker reads `vendors.skuSamples` (plus legacy `skuSample`) *fresh on every
   job run* and injects them as the format anchor. So deleting a sample from the
   vendor record is the whole update — from the next run onward Tidy no longer
   anchors on the removed format. No agent-side sync step exists or is needed.

2. **Server endpoint.** `DELETE /api/vendors/:name/sample` with body
   `{ skuSample }` pulls the value from `skuSamples` (`$pull`) and also clears the
   legacy single `skuSample` when it matches, then returns the updated vendor.

3. **UI.** Each saved-sample chip in `VendorSetup`'s manage mode gets a small ✕
   button that calls the endpoint and updates the list from the response. Removing
   the last sample drops the card back to setup mode (no anchor remains), inviting
   the user to add one again.

4. **No re-run on removal.** Consistent with adding a sample in manage mode, removal
   doesn't re-process the current document (its SKUs are already produced); the
   change takes effect on subsequent runs. The user can re-run manually if they want
   this document rebuilt without the removed format.

## Alternatives Considered

| Option | Why not chosen |
|--------|----------------|
| **Re-run the job on removal** | Wasteful; removal targets future/other documents, and manage-mode add already doesn't re-run. |
| **Soft-delete / archive samples** | No need — samples are cheap user-entered strings; a hard `$pull` is simplest and reversible by re-adding. |
| **Also purge related corrections** | Out of scope and undesirable: corrections are a separate, higher-fidelity learned signal; removing a setup sample shouldn't discard real user fixes. |

## Consequences

- Vendors can be curated: stale or wrong formats are removed and stop influencing
  Tidy on the next run.
- Removing all samples reverts the vendor to the unanchored state (model best-effort
  + corrections), surfaced as the setup card again.
- Reversible: re-add the sample.
