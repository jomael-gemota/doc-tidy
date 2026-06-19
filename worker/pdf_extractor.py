"""Extract text content from a PDF byte buffer using pdfplumber."""

from __future__ import annotations

import io
import logging

import pdfplumber

logger = logging.getLogger(__name__)


def extract_text(pdf_bytes: bytes) -> str:
    """Return the full text of a PDF, one page at a time, separated by newlines."""
    pages: list[str] = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            if text.strip():
                pages.append(f"--- Page {i} ---\n{text.strip()}")
            else:
                logger.debug("Page %d has no extractable text (may be scanned/image)", i)

    if not pages:
        raise ValueError(
            "No extractable text found in the PDF. "
            "The file may contain only scanned images."
        )

    return "\n\n".join(pages)
