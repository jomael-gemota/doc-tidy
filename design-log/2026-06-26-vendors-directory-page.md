# Vendors Directory Page with Correction Management

**Date:** 2026-06-26
**Status:** accepted
**Author:** collaborative

## Context

Until now vendors and their learned corrections were only visible in the context
of a single job: SKU samples via the `VendorSetup` card on a completed job, and
the before/after diff via `OutputPanel`. There was no place to see the full
roster of vendors Tidy has learned, nor to review or prune the corrections that
drive few-shot retrieval (`worker/corrections.py`).

Related prior entries:
- `2026-06-25-vendor-scoped-corrections.md` — corrections are vendor-scoped via
  normalized `vendorName`.
- `2026-06-26-remove-vendor-sku-samples.md` — precedent that the worker reads
  learning data (samples) *fresh on every run*, so a DB delete is the whole
  update; no worker sync step exists or is needed.

## Decision

Add a second sidebar menu item, **Vendors**, routing to a new `/vendors` page
that lists every registered vendor with:

- vendor name + saved SKU sample formats,
- all corrections/suggestions captured for that vendor (filename, date,
  optional note, before/after output),
- a **Delete** action per correction guarded by a confirmation modal.

Corrections whose `vendorName` is null or doesn't match a registered vendor are
grouped under an **Unassigned** section so nothing is hidden.

### Data flow

- New `GET /api/corrections` exposes the existing `listCorrections()` helper
  (embedding stripped). The page also calls the existing `GET /api/vendors`.
  Grouping by normalized vendor name happens client-side, mirroring
  `normalizeVendorName()`.
- New `DELETE /api/corrections/:id` removes the correction document via a new
  `deleteCorrection()` mongodb helper.
- New `DELETE /api/vendors/:name` removes the vendor **and cascade-deletes every
  correction captured for it** via a new `deleteVendor()` helper, so a vendor and
  the corrections shown beneath it on the page are removed as a single unit and no
  orphan corrections linger under Unassigned. Cascade matching uses normalized
  `vendorName` equality (same key the page groups by). Both deletes are guarded by
  the shared `ConfirmModal`; the vendor dialog spells out how many SKU formats and
  corrections will be removed.

### Why deleting from the DB is enough for Tidy

`retrieve_examples()` queries `db.corrections` at the start of every job run and
keeps no in-memory cache. Once a correction document is deleted it simply stops
appearing in the candidate set from the next run onward — exactly the same
contract as removing a vendor SKU sample. No WebSocket notification to the worker
is required. In-flight jobs that already injected the example are unaffected.

## Alternatives Considered

- **One aggregated `GET /api/vendors/overview` endpoint** joining corrections
  server-side. Rejected for the MVP: client-side grouping reuses two existing
  list endpoints, keeps the server surface small, and correction volume is low.
- **Inline two-click confirm** (like `BatchTable` delete) instead of a modal.
  Rejected because the user explicitly asked for a confirmation modal, and a
  destructive delete that affects Tidy's learning warrants a deliberate dialog.
- **Cascading correction deletes when a job is deleted.** Out of scope here;
  the Unassigned/orphan grouping makes stale corrections visible and removable.

## Consequences

- New server route file `server/src/routes/corrections.ts` registered at
  `/api/corrections`.
- New client page `client/src/pages/VendorsPage.tsx`, plus a reusable
  `ConfirmModal` component and the sidebar/route/title wiring.
- No worker changes. A deleted correction stops influencing Tidy from the next
  run; currently running jobs are unaffected.
- Orphan corrections (job since deleted) appear under Unassigned and can be
  cleaned up here.
