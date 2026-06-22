# Job Layout: Wider JSON Panel

**Date:** 2026-06-23
**Status:** accepted
**Author:** collaborative

## Context

After improving JSON readability and syntax highlighting, the user requested a wider JSON area on the Job page to improve scanability for larger objects.

## Decision

Change the desktop split layout from equal columns to a JSON-prioritized ratio:

- Left reasoning panel: 2/5 width
- Right JSON output panel: 3/5 width

Mobile behavior remains unchanged (single-column stack).

## Alternatives Considered

- Keep 50/50 split and only increase font size.
  - Rejected because width is the primary constraint for nested objects.
- Make panels resizable by dragging.
  - Rejected for now as unnecessary complexity for this scope.

## Consequences

- JSON structure is easier to read with fewer wraps.
- Reasoning area remains visible but less dominant.
- No behavior changes; only layout proportions are updated.
