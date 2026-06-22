# JSON Syntax Highlighting (Postman-like)

**Date:** 2026-06-23
**Status:** accepted
**Author:** collaborative

## Context

The JSON output panel is now structurally stable, but users requested a more Postman-like presentation where property names and values are colorized for faster scanning.

## Decision

Implement lightweight, dependency-free JSON syntax highlighting in the frontend component by rendering parsed JSON recursively with token-specific colors:

- property names,
- string values,
- number values,
- boolean and null values,
- punctuation.

The panel keeps its existing streaming behavior and fallback rendering for non-JSON output.

## Alternatives Considered

- Add a syntax-highlighting dependency (e.g., Prism, Highlight.js).
  - Rejected to avoid extra package weight and theme overhead.
- Regex-based token coloring on serialized strings.
  - Rejected due to edge cases and lower reliability compared with recursive rendering.

## Consequences

- JSON is easier to read and visually closer to API tools like Postman.
- No new dependency or backend changes required.
- Slightly more rendering logic in the JSON component, but isolated and maintainable.
