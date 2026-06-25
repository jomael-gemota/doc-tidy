# SKU Setup Reachable for Unrecognized Vendors

**Date:** 2026-06-26
**Status:** accepted
**Author:** collaborative

## Context

The Document Batches table flags a job with **"Needs SKU formats"** whenever the
job's `vendorNeedsSetup` is true (`BatchTable.tsx` → `DocumentFlags`). But the
Extraction Results page (`JobPage.tsx`) only renders the `VendorSetup` card when
`vendorName` is truthy:

```tsx
{id && vendorName && status === 'completed' && <VendorSetup … />}
```

The worker sets `vendorNeedsSetup = true` for a document that **has line items but
whose vendor isn't registered** (`worker/worker.py`). In that branch the stored
`vendorName` is `extract_vendor_name(result_json) or detected_vendor`, which is
**`null`** when the model didn't emit the vendor under a recognized key and the
text didn't match an already-registered vendor.

Result: a job can be flagged "Needs SKU formats" while `vendorName` is `null`, so
the setup card is gated out and **the user has no way to add the vendor's SKU
formats** — exactly the reported bug.

## Decision

1. **Render the setup card whenever setup is needed.** `JobPage` shows
   `VendorSetup` when the job is completed **and** (`vendorName` is set **or**
   `vendorNeedsSetup` is true). This keeps the existing "manage samples" card for
   known vendors and adds the missing path for unrecognized ones.

2. **`VendorSetup` handles an unknown vendor name.** Its `vendorName` prop becomes
   `string | null`. When no usable name is present, the card renders an extra
   **"Vendor name"** input next to the sample-SKU input (setup mode only), so the
   user supplies the name and a real SKU together. Saving registers the vendor via
   the unchanged `POST /api/vendors { name, skuSample }`.

3. **Registration still binds to this document via re-run.** Saving never re-runs
   the job (unchanged behaviour). On the next run, `detect_vendor_name_from_text`
   matches the now-registered vendor name against the document text, resolves the
   vendor, and clears `vendorNeedsSetup` — so the badge clears after the user
   registers and re-runs, even when the model couldn't extract the name itself.

## Alternatives Considered

| Option | Why not chosen |
|--------|----------------|
| **Only fix the `JobPage` gate (`vendorName \|\| vendorNeedsSetup`)** | Necessary but insufficient: with a `null` name, `VendorSetup` had nothing to register against. The name input completes the flow. |
| **Have the worker always store a non-null `vendorName` (placeholder)** | A fabricated placeholder pollutes vendor records and corrections keyed on vendor name; better to let the user provide the real name. |
| **Add a job-level PATCH to set `vendorName` on save** | The existing register-then-re-run flow already rebinds the vendor via text detection; a separate write path adds complexity without clear benefit. |

## Consequences

- `VendorSetup` now owns a small amount of vendor-name state for the unknown case;
  for known vendors behaviour is unchanged.
- The "Needs SKU formats" badge still reflects the stored `vendorNeedsSetup` flag,
  which only clears on re-run — consistent with its tooltip ("Add its SKU formats,
  then re-run").
- Reversible: restore the `vendorName`-only gate and drop the name input.
