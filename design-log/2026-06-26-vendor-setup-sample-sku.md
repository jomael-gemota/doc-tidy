# Vendor Setup via a Sample SKU (format anchor)

**Date:** 2026-06-26
**Status:** accepted
**Author:** collaborative

## Context

The new-vendor setup card on the extraction results page
(`client/src/components/VendorSetup.tsx`) currently asks the user for two things:

1. a required **SKU initial** (e.g. `K`), and
2. an optional **SKU format** expressed as a *template / object string*
   (`{initial}{styleNumber}{colorCode}{size}{width}`).

Per [2026-06-25-llm-built-skus-per-vendor.md](2026-06-25-llm-built-skus-per-vendor.md),
SKUs are no longer assembled by deterministic Python — Tidy (the Hermes agent)
builds each SKU itself and learns a vendor's format from corrections. That entry
left `skuInitial`/`skuFormat` as inert registration metadata and listed, as
explicit follow-up work: *"Optionally retire `skuInitial`/`skuFormat` from the
vendor setup UI + server schema, or repurpose the setup step into plain vendor
registration."*

The user asked to make the setup more natural: instead of authoring a template
in placeholder syntax, **let the user paste one real, sample SKU** for the vendor
and let Tidy learn the format from that example and reproduce it for that vendor
going forward.

This entry references and **supersedes** decision #4's parenthetical in the
prior entry ("No 'golden pattern' pinned to the vendor record for now"): a
setup-time sample SKU *is* pinned to the vendor record, as a cold-start format
anchor that complements (does not replace) the correction-retrieval loop.

## Decision

1. **Setup captures a single sample SKU.** Replace the `skuInitial` (required) +
   `skuFormat` (template) inputs with one free-text field where the user pastes an
   actual SKU exactly as it should look for that vendor (e.g. `K12345-BLK-7.5M`).
   It is stored on the vendor record as `skuSample`.

2. **The sample is a per-vendor format anchor injected into the prompt.** A
   setup-time sample is not a document correction (the user supplies only a SKU
   string, not a full corrected `lineItems` JSON), so it cannot flow through the
   correction-retrieval loop, which requires a `documentTextSample` + embedding +
   `correctedOutput`. Instead, when the worker identifies a *registered* vendor
   from the raw text **before extraction**, it loads that vendor's `skuSample` and
   passes it to `stream_tidy`, which appends a hard-rule section instructing the
   model to reproduce that vendor's SKU format exactly (same components, order,
   separators, prefix/initial, and value transformations) for every row.

3. **Corrections still win and refine.** Actual user corrections retrieved for the
   vendor remain the authoritative, higher-fidelity signal (they carry full
   row-level context). The sample anchor's job is the **cold start**: it gives Tidy
   a correct target on the very first real run for a freshly-registered vendor,
   before any correction exists. Both reinforce the same format; corrections layer
   on top as the vendor accrues fixes.

4. **`skuInitial`/`skuFormat` are retired from the setup path.** The vendor schema
   keeps them optional for backward compatibility with already-registered vendors,
   but the setup UI and the `POST /api/vendors` contract no longer accept or
   require them — `skuSample` is the single setup input. No deterministic assembler
   consumes any of these fields (removed in the prior entry).

## Alternatives Considered

| Option | Why not chosen |
|--------|----------------|
| **Keep the `{...}` template field** | The placeholder syntax is unintuitive and still asks the user to *author a format spec*. A real sample SKU is what users actually have on hand, and the model learns formats from examples better than from templates. |
| **Synthesize a fake correction from the sample** | A correction needs a `documentTextSample`, embedding, and full `correctedOutput`. We only have a bare SKU string at setup time, so a fabricated correction would be low-quality and pollute the retrieval pool. |
| **Parse the sample into structured components and rebuild deterministically** | Reintroduces the deterministic assembler the prior entry deliberately removed; cannot express the full variety of vendor formats. |
| **Store nothing; rely solely on the post-run correction loop** | Leaves the first run for every new vendor with no format guidance — exactly the cold-start gap the user wants closed. |

## Consequences

- New first-run guidance for freshly-registered vendors without waiting for a
  correction. Lower chance the user has to fix the very first batch.
- `skuSample` lives on the vendor record (a small, intentional bit of per-vendor
  state), reversing the prior "retrieval is the single source of truth" stance for
  this specific cold-start anchor. Corrections remain the source of truth for
  refinements.
- The anchor is injected only when the vendor is **registered and detected from
  raw text** before extraction (the existing `detect_vendor_name_from_text` path);
  unregistered vendors still get the model's best-effort SKU and the
  register-then-correct flow.
- Reversible: drop the `skuSample` field and the prompt-injection branch to return
  to pure registration.

## Follow-up work

- Consider letting the user paste **multiple** sample SKUs (e.g. one per size /
  width variant) if a single example proves insufficient for complex formats.
- Optionally surface, on later runs, when the model's SKU diverges from the stored
  sample's shape, to catch drift.
