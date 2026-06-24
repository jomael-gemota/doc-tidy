# SKU Extraction & Learning System (OCR + Vendor Profiles + Correction Memory)

**Date:** 2026-06-25
**Status:** accepted
**Author:** collaborative

## Context

The real job Doc Tidy must do is **build SKUs from PDF line-item tables**. For each
row a SKU is assembled by concatenating `styleNumber + colorCode + size + width`
and prepending a per-vendor **initial**. Getting there is hard because:

- Line-item tables vary wildly between vendors (where the size lives, whether a
  width column exists, which column is the *real* Qty vs. a pack/case count).
- PDFs are **both digital and scanned** — scanned files produce no extractable
  text today, so they fail outright.
- There are **hundreds** of distinct vendor formats — far too many to template by
  hand.
- The user wants to **correct Tidy in the web app and have it improve over time**,
  becoming "wiser" as more documents + corrections are fed in.

This entry **extends and supersedes**
[2026-06-24-correction-feedback-memory.md](2026-06-24-correction-feedback-memory.md).
That entry proposed the correction feedback loop + few-shot memory, which remains
the core of "learning." This entry refines it with three decisions that came out
of clarifying the actual use case, plus the realistic mechanics of OCR and scale.

Clarified requirements (from the user):

1. **SKU initial** is user-decided but **fixed per brand/vendor** once chosen.
2. PDFs are **both** text-based and scanned → **local OCR** (Tesseract, stays on
   the Ubuntu box; no cloud, for cost/privacy).
3. **Hundreds** of vendor formats. The vendor identifier, when present, is the
   **vendor name** (sometimes inconsistent). A **one-time setup** per new vendor
   (confirm the initial + correct the first doc) is acceptable.

Related prior context:
[2026-06-19-architecture.md](2026-06-19-architecture.md).

## Decision

### Guiding principle: separate EXTRACTION from ASSEMBLY

```
PDF → [1. EXTRACTION]            → normalized line items → [2. SKU ASSEMBLY] → SKU
        digital: pdfplumber        {styleNumber, colorCode,   deterministic
        scanned: local OCR          size, width|null, qty}      Python (no LLM)
        (LLM structures it)                                   + per-vendor initial
```

- **Extraction is the LLM's job** and the *only* thing corrections teach. This is
  the genuinely hard, format-dependent part.
- **SKU assembly is deterministic Python.** The model never concatenates the SKU
  and never guesses the initial — both are error-prone for an LLM and trivial in
  code. This keeps SKUs correct-by-construction and makes every error
  attributable to extraction (debuggable).

### Phase 0 — Foundation (worker only; prerequisites for everything else)

**0a. Per-page extraction routing** in `worker/pdf_extractor.py`:

```
for each page:
    text = page.extract_text()
    if text is empty/sparse:        → scanned page → local OCR (Tesseract)
    else:                           → digital page → page.extract_tables() + text
```

- Digital pages: prefer `page.extract_tables()` so the line-item column structure
  (Style | Color | Size | Width | Qty) survives into the prompt, with
  `extract_text()` kept as surrounding context.
- Scanned pages: rasterize (`pdf2image`/poppler) and OCR with `pytesseract`.
- **Graceful degradation:** if OCR libraries/binaries are missing, log a clear
  warning and fall back to text-only (current behavior) rather than crashing.
- Return a structured result (per-page text + any extracted tables) instead of
  one flat string, so downstream prompting can present tables faithfully.

**0b. Raise truncation caps.** `MAX_DOCUMENT_CHARS=12_000` and `MAX_TOKENS=2048`
silently cut long line-item tables, producing partial SKUs. Raise both
substantially and/or process per-page so large catalogs aren't truncated.

### Phase 1 — Schema + deterministic SKU builder + vendor store

- **Explicit line-item schema** in `SYSTEM_PROMPT` instead of "extract all
  meaningful fields." Target shape per row:
  `{ styleNumber, colorCode, size, width|null, qty }` plus document-level vendor
  fields. Be explicit about disambiguating Qty vs pack/case counts.
- **`build_sku(item, vendor)`** — pure Python. Join order and separators live in
  config; the per-vendor `skuInitial` is read from the vendor record. Never
  produced by the model.
- **`vendors` collection**: `{ vendorId, name, signature, skuInitial,
  skuFormat?, createdAt }`. Seeds the initial once per vendor.

### Phase 2 — Vendor detection

- A lightweight step maps a document → `vendorId` using the **vendor name**
  (primary) plus a layout/header signature as backup, since the name is sometimes
  inconsistent. Unknown signature → "new vendor" one-time setup flow (confirm
  initial + correct first doc), then remembered.
- `vendorId` keys both the SKU initial *and* the correction retrieval filter.

### Phase 3 — Correction capture (the learning loop)

As in the superseded entry, refined to the line-item level:

- **`corrections` collection**: `{ jobId, vendorId, filename, documentTextSample,
  embedding, originalOutput, correctedOutput, note?, createdAt }`.
- **Server:** `POST /api/jobs/:jobId/correct` accepting `{ correctedOutput, note?,
  vendorId? }`; computes an embedding and inserts a correction. Helpers in
  `server/src/lib/mongodb.ts` (`createCorrection`, `listCorrections`,
  retrieval helper).
- **Client:** make the line-items table editable ("Suggest a fix" → edit cells +
  optional note → Save), POSTing the corrected JSON. This structured edit *is*
  the "conversation" with Tidy — easier to learn from than free-form chat.

### Phase 4 — Retrieval + few-shot injection

- For each new job, retrieve top-K corrections **filtered by `vendorId` first**,
  then by embedding similarity (cold start for never-seen vendors falls back to
  base model + schema).
- Inject retrieved corrections as prior user/assistant turns before the real
  document in `stream_tidy(document_text, examples=...)`.
- **Scale:** given hundreds of vendors, use **MongoDB Atlas Vector Search** rather
  than in-Python cosine scoring, behind a stable `retrieve_examples()` interface.
- Embeddings via a small model (reuse `OPENAI_API_KEY` already used for
  narration); if unavailable, retrieval returns `[]` and parsing degrades to
  stateless behavior.

## Alternatives Considered

| Option | Why not chosen (now) |
|--------|----------------------|
| **LLM builds the full SKU string** | Occasionally drops width / reorders / hallucinates digits, and makes errors ambiguous (extraction vs concatenation). Deterministic assembly is correct-by-construction. |
| **Cloud vision model for scans** | Better on messy tables, but a paid per-page call and data leaves the machine. User chose local OCR for cost/privacy. Revisit if Tesseract accuracy is insufficient. |
| **Per-vendor hand-written templates** | Impossible at hundreds of vendors. Correction memory generalizes instead. |
| **In-Python cosine retrieval (MVP)** | Fine at dozens of corrections; at hundreds of vendors Atlas Vector Search is warranted sooner. |
| **Fine-tuning the model** | Real weight change, but expensive, periodic (not daily), needs a large clean corpus. The stored corrections become that corpus later. |
| **Free-form chat with the agent** | Hard to convert into reliable training signal. Structured cell edits + a note capture the same intent and are directly reusable. |

## Consequences

- **Scanned PDFs work** for the first time (local OCR), but Tesseract quality on
  dense tables is the main accuracy risk — measure it before layering learning on
  top.
- **SKUs are reliable** because assembly is deterministic; corrections target only
  what's hard (extraction).
- **New moving parts:** OCR stage + deps (Tesseract binary + poppler +
  `pytesseract`/`pdf2image`), `vendors` and `corrections` collections, a vendor
  detection step, a correction endpoint + editable UI, embeddings + retrieval.
  Each degrades gracefully to today's behavior if disabled/unavailable.
- **Privacy:** corrected outputs + document text samples are stored (internal tool
  — acceptable). Inference + OCR stay local.
- **Reversible:** OCR falls back to text-only; corrections/retrieval can be
  disabled to restore stateless parsing.

## Follow-up work

- Implement in order: Phase 0 (extraction + caps) → Phase 1 (schema + `build_sku`
  + vendors) → Phase 2 (vendor detection) → Phase 3 (capture) → Phase 4
  (retrieval).
- Benchmark Tesseract table accuracy on a sample of real scanned vendor PDFs.
- Build a "corrections review" admin view once volume grows.
- Re-evaluate fine-tuning once a large, clean correction corpus exists.
