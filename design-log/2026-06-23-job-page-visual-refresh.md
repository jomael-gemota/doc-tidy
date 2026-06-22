# Job Page Visual Refresh

**Date:** 2026-06-23
**Status:** accepted
**Author:** collaborative

## Context

The job page currently works functionally but looks flat and less polished than expected for a production-facing workflow screen. The main readability issue is the `JSON Output` panel, where code text appears small and low-emphasis relative to surrounding UI.

This update builds on the existing split-view architecture and recent reasoning stream improvements without changing stream behavior.

## Decision

Adopt a more professional dashboard-style presentation for the job page:

1. Add a cleaner top bar and constrained content container for improved visual structure.
2. Convert both side-by-side sections into card-like panels with subtle borders, rounded corners, and soft shadows.
3. Improve `JSON Output` readability by:
   - increasing text size and line-height,
   - using stronger text contrast,
   - placing JSON in a dedicated code surface with clear boundaries,
   - preserving monospace rendering and wrap behavior.
4. Keep existing status signaling and streaming behavior unchanged.

## Alternatives Considered

- Add custom syntax highlighting for JSON tokens.
  - Rejected for now to keep implementation lightweight and avoid extra dependencies.
- Keep the current full-bleed split layout and only adjust typography.
  - Rejected because layout hierarchy is part of the perceived quality issue.

## Consequences

- The page should feel more modern and professional while preserving current functionality.
- JSON output becomes easier to scan for keys, nested structure, and values.
- Minimal risk: changes are primarily presentational and isolated to frontend view components.
