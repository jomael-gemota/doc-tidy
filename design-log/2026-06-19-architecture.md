# Doc Tidy — System Architecture

**Date:** 2026-06-19
**Status:** accepted
**Author:** collaborative

## Context

Doc Tidy is an Intelligent Document Processing web application that accepts PDF uploads and returns structured JSON data by using an AI agent (named "Tidy") to parse the document content. The key differentiator is that users can see the agent's live reasoning stream from start to finish.

Three distinct runtime environments are involved:
- A web application accessible via browser (deployed to Railway)
- A worker process on a dedicated Ubuntu machine
- The Tidy agent (OpenAI GPT-5.5), called by the worker

## Decision

### Architecture: Three-tier with WebSocket relay and SSE streaming

```
Browser (Vite/React)
  │  POST /api/upload (PDF)
  │  GET  /api/stream/:jobId (SSE)
  ▼
Express Server (Railway)
  │  WebSocket (persistent, worker-initiated)
  ▼
Python Worker (Ubuntu)
  │  OpenAI API (streaming HTTP)
  ▼
Tidy / GPT-5.5 (OpenAI)

All tiers read/write to MongoDB Atlas (GridFS for PDFs, jobs collection for state)
```

**Communication layers:**
- Browser → Server: REST for upload, SSE for live streaming
- Server ↔ Worker: persistent WebSocket (worker connects out to Railway on startup)
- Worker → Tidy: OpenAI Python SDK with `stream=True`

### Frontend: Vite + React + TypeScript + Tailwind

Next.js was considered but rejected in favour of Vite for its faster development iteration and simpler mental model. React Router v6 handles client-side navigation. The Express server serves the built Vite assets in production, making deployment a single Railway service.

### Backend: Express.js + TypeScript

Express with the `ws` package provides full control over the WebSocket upgrade lifecycle. `multer` handles multipart PDF uploads. `mongodb` native driver is used directly (no Mongoose) to keep the dependency surface small.

### Worker: Python 3.11 + asyncio

Python is the natural choice for document processing tooling (`pdfplumber`) and OpenAI SDK usage. The worker maintains a single persistent WebSocket connection to the Express server and processes jobs as `asyncio.Task` instances for concurrency.

### Agent: Hermes (Nous Research) running locally on Ubuntu

The Hermes agent — named "Tidy" — runs as a local LLM server on the same Ubuntu machine as the worker. The worker calls it via its **OpenAI-compatible chat completions API** (e.g. `http://localhost:8080/v1`) using the OpenAI Python SDK with a custom `base_url`. No cloud API calls are made for inference.

The Tidy system prompt instructs Hermes to write reasoning inside `<thinking>` tags before producing a final JSON object. The worker parses the stream into `thinking` and `output` event types and relays them separately so the browser can render two distinct live panels.

Three env vars control the connection: `HERMES_BASE_URL`, `HERMES_MODEL`, and `HERMES_API_KEY` (optional for local servers).

### Database: MongoDB Atlas

GridFS stores raw PDF bytes. A `jobs` collection tracks status, accumulated thinking text, and the final JSON output. Motor (async MongoDB driver) is used in the worker; the native MongoDB Node.js driver is used in the server.

## Alternatives Considered

| Option | Reason not chosen |
|--------|-------------------|
| Next.js (App Router) | Heavier framework; user preference for Vite |
| Ollama native API (`/api/generate`) | OpenAI-compatible endpoint is more portable across different Hermes server backends |
| Redis/BullMQ job queue | Overkill for single-worker topology; direct WebSocket is simpler |
| Server-Sent Events for Worker→Server | SSE is unidirectional; WebSocket allows bidirectional job assignment + streaming |
| Mongoose ORM | Extra abstraction layer not needed for this schema |

## Consequences

- The Worker must be able to reach the Railway domain over HTTPS/WSS (outbound from Ubuntu — typically unrestricted).
- If the Worker restarts, it reconnects and re-registers; in-flight jobs may be lost and must be retried by the user.
- A single OpenAI API key is required in the worker `.env`; rate limits apply per key.
- For future horizontal scaling, the in-memory SSE registry would need to be replaced with a Redis pub/sub layer.
