"""One-off backfill: align ``corrections.vendorName`` with registered vendors.

Vendor-scoped correction retrieval (see
design-log/2026-06-25-vendor-scoped-corrections.md) keys on a normalized vendor
name. Corrections stored before that change may hold a per-document spelling
(e.g. "ACME INC.") that doesn't normalize to a registered vendor's canonical
name (e.g. "Acme Inc"), so they'd never be retrieved for that vendor.

This script rewrites each correction's ``vendorName`` to the **canonical**
registered vendor name when one can be identified, so detection reproduces the
same key on future uploads. It is idempotent and safe to re-run.

A correction is matched to a vendor by, in order:
  1. normalized equality of its stored ``vendorName``; else
  2. detecting a registered vendor name inside its ``documentTextSample``.

Usage (run from the worker/ directory so imports resolve):
    python backfill_correction_vendors.py            # dry run — reports only
    python backfill_correction_vendors.py --apply     # write the changes
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os

import motor.motor_asyncio
from dotenv import load_dotenv

from sku import normalize_vendor_name

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("backfill")

MONGODB_URI = os.environ["MONGODB_URI"]
MONGODB_DB = os.environ.get("MONGODB_DB", "doc-tidy")


def _match_vendor(
    vendor_name: str | None,
    document_text_sample: str,
    vendors: list[dict],
) -> str | None:
    """Return the canonical registered vendor name for a correction, or None.

    Mirrors the runtime detection logic: exact normalized match on the stored
    name first, then a longest-substring match against the document sample.
    """
    norm_name = normalize_vendor_name(vendor_name) if vendor_name else ""
    if norm_name:
        for vendor in vendors:
            if (vendor.get("normalizedName") or "") == norm_name:
                return vendor.get("name") or norm_name

    haystack = normalize_vendor_name(document_text_sample or "")
    best_name: str | None = None
    best_len = 0
    for vendor in vendors:
        normalized = vendor.get("normalizedName") or normalize_vendor_name(
            vendor.get("name") or ""
        )
        if normalized and normalized in haystack and len(normalized) > best_len:
            best_name = vendor.get("name") or normalized
            best_len = len(normalized)
    return best_name


async def run(apply: bool) -> None:
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URI)
    db = client[MONGODB_DB]

    vendors = await db.vendors.find(
        {}, projection={"name": 1, "normalizedName": 1}
    ).to_list(length=10_000)
    logger.info("Loaded %d registered vendor(s)", len(vendors))
    if not vendors:
        logger.warning("No registered vendors — nothing to align against. Exiting.")
        return

    corrections = await db.corrections.find(
        {}, projection={"vendorName": 1, "documentTextSample": 1}
    ).to_list(length=100_000)
    logger.info("Scanning %d correction(s)", len(corrections))

    updated = 0
    unchanged = 0
    unmatched = 0
    for corr in corrections:
        current = corr.get("vendorName")
        canonical = _match_vendor(current, corr.get("documentTextSample", ""), vendors)

        if canonical is None:
            unmatched += 1
            logger.info(
                "  [no match] %s — vendorName=%r left as-is", corr["_id"], current
            )
            continue
        if canonical == current:
            unchanged += 1
            continue

        logger.info(
            "  [align]    %s — %r -> %r", corr["_id"], current, canonical
        )
        if apply:
            await db.corrections.update_one(
                {"_id": corr["_id"]}, {"$set": {"vendorName": canonical}}
            )
        updated += 1

    verb = "Updated" if apply else "Would update"
    logger.info(
        "Done. %s %d, unchanged %d, unmatched %d.", verb, updated, unchanged, unmatched
    )
    if not apply and updated:
        logger.info("Dry run — re-run with --apply to write these %d change(s).", updated)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write changes. Without this flag the script only reports (dry run).",
    )
    args = parser.parse_args()
    asyncio.run(run(args.apply))


if __name__ == "__main__":
    main()
