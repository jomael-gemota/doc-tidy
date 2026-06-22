# JSON Panel Overflow Fix

**Date:** 2026-06-23
**Status:** accepted
**Author:** collaborative

## Context

After the job page visual refresh, the JSON output code surface sometimes showed text outside the rounded bordered container. This made the panel look broken and reduced readability.

## Decision

Keep the JSON code container at full panel height, but move vertical scrolling to that same container. This ensures long content scrolls inside the bordered surface instead of overflowing beyond it.

## Alternatives Considered

- Remove fixed-height behavior from the code surface.
  - Rejected because the panel should still visually occupy full height in split view.
- Keep scroll on the outer wrapper and rely on clipping.
  - Rejected because content could still visually escape the intended code surface.

## Consequences

- JSON stays inside the rounded code area at all content lengths.
- The panel appears consistent and professional.
- Streaming behavior remains unchanged.
