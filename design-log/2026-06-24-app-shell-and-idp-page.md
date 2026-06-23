# App Shell (Sidebar + Navbar) and Intelligent Document Processing Page

**Date:** 2026-06-24
**Status:** accepted
**Author:** collaborative

## Context

Until now the client had two standalone pages (`/` upload, `/jobs/:id` workspace) with
no shared chrome — each page owned its own header. As the product grows we want a
persistent application shell (left sidebar + top navbar) and a single hub screen for
document processing.

This builds on the existing architecture (Vite + React + Tailwind, react-router v7,
SSE streaming via `useJobStream`, jobs in MongoDB) recorded in
`2026-06-19-architecture.md` and the job-page visual work in
`2026-06-23-job-page-visual-refresh.md`. It does not change streaming behavior.

## Decision

1. **Shared layout shell** — Add `Layout` with a fixed left **Sidebar** (brand + nav)
   and a top **Navbar** (page title + live worker-connection status). It is responsive:
   the sidebar is a drawer on small screens, persistent on `lg+`. All routes render
   inside `Layout` via `<Outlet/>`.

2. **Sidebar nav item "Intelligent Document Processing"** — The primary destination
   (route `/`). It hosts:
   - PDF upload (reusing `UploadZone`).
   - A polished **horizontal reasoning stepper** showing Tidy's live thinking for the
     job that is currently processing (numbered nodes with connectors + a streaming
     detail panel below).
   - A **Batches table** listing every uploaded document across all users with full
     metadata, plus a per-row **View JSON** action.

3. **Terminology** — A "batch" in the UI maps 1:1 to an existing `job` (one PDF → one
   extraction). No schema change is introduced; we reuse the `jobs` collection.

4. **New list endpoint** — `GET /api/jobs` returns all jobs (newest first) with the
   large `thinking` field projected out for payload efficiency. `jsonOutput` is kept so
   the "View JSON" modal can render instantly without an extra round-trip.

5. **Shared JSON renderer** — Extract the recursive syntax-highlight renderer out of
   `JsonOutput.tsx` into `lib/jsonHighlight.tsx` so both the workspace panel and the new
   batch JSON modal share one implementation (behavior-preserving).

## Alternatives Considered

- **Introduce a real "batches" collection** grouping multiple PDFs per upload.
  - Rejected for now: the current pipeline is one-PDF-per-job; modelling multi-file
    batches is a larger backend change. The UI uses "batch" as a friendly label for a
    job, leaving room to evolve later.
- **Per-row fetch of `/api/jobs/:id` for JSON modal** instead of including `jsonOutput`
  in the list payload.
  - Rejected for snappier UX; revisit if list payloads grow large.
- **Keep per-page headers, no shared shell.**
  - Rejected: a persistent sidebar/navbar is the explicit goal and scales to more pages.

## Consequences

- New components: `Layout`, `Sidebar`, `Navbar`, `ReasoningStepper`, `BatchTable`,
  `JsonModal`; new page `IdpPage`; new hook `useBatches`; shared `lib/jsonHighlight`.
- `App.tsx` routes are nested under `Layout`. `JobPage` renders inside the content area;
  its container switches from `min-h-screen` to fit the shell.
- `GET /api/jobs` is added; `listJobs()` added to `lib/mongodb.ts`.
- A `typecheck` script is added to `client/package.json` so `npm run check` works as the
  Quality Gate rule expects.
- Low risk: changes are additive; streaming and the existing job workspace keep working.
