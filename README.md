# Doc Tidy

AI-powered document processing: upload a PDF, watch the agent reason in real time, and get structured JSON.

![Doc Tidy hero](client/src/assets/hero.png)

## Features

- **PDF upload** via the browser
- **Live reasoning stream** — see the agent's `<thinking>` tokens as they arrive
- **Structured JSON output** — parsed and displayed when processing completes
- **Local OCR** — scanned pages are read with Tesseract (no cloud); digital pages keep their table structure
- **Agent-built SKUs** — Tidy builds each line item's full SKU itself and learns each vendor's format from your corrections (no fixed code template), so even complex, vendor-specific formats are handled
- **Vendor profiles** — a one-time per-vendor registration scopes corrections to that vendor; new vendors are flagged in the UI
- **Learning loop** — correct a job's output in the browser; corrections are embedded and retrieved as vendor-scoped few-shot examples that steer similar future documents (and are pulled per vendor so a learned format is remembered indefinitely)
- **Flexible LLM backend** — Hermes Agent, OpenAI, or Ollama (OpenAI-compatible API)
- **Three-tier architecture** — web app on Railway, worker on your Ubuntu machine, shared MongoDB Atlas

## How it works

1. You upload a PDF in the browser (`POST /api/upload`).
2. The server stores the PDF in MongoDB GridFS and creates a job record.
3. The Python worker (connected over WebSocket) picks up the job, extracts text, and streams tokens from the LLM.
4. The server relays tokens to the browser via SSE (`GET /api/stream/:jobId`).
5. When complete, the final JSON is saved and shown on the job page.

```
Browser (Vite/React) ──SSE──▶ Express Server (Railway)
                                     │ WebSocket
                               Python Worker (Ubuntu)
                                     │ OpenAI-compatible API
                               Tidy Agent (Hermes / OpenAI / Ollama)

All tiers share MongoDB Atlas (GridFS for PDFs, jobs collection for state)
```

> **Important:** The worker must be running and connected before jobs can be processed. Check `GET /api/health` — `workerConnected` should be `true`.

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20.19 |
| Python | ≥ 3.11 |
| Docker | any recent (for local MongoDB) |
| LLM backend | Hermes Agent, OpenAI API key, or Ollama |

## Quick start (local development)

### 1. Start MongoDB

```bash
docker compose up -d
```

### 2. Install dependencies

```bash
npm install   # client/ and server/ workspaces
```

### 3. Configure the server

```bash
cp server/.env.example server/.env
# Defaults work with local Docker MongoDB
```

### 4. Configure the worker

```bash
cp worker/.env.example worker/.env
# Set HERMES_* (see Environment Variables) and SERVER_WS_URL
```

### 5. Start server + client

```bash
npm run dev
```

Or in separate terminals:

```bash
npm run dev --workspace=server
npm run dev --workspace=client
```

### 6. Start the worker

> Ubuntu 24.04+ protects system Python — always use a virtual environment.

```bash
cd worker
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python worker.py
```

Re-activating in a new terminal:

```bash
cd worker
source .venv/bin/activate        # Windows: .venv\Scripts\activate
```

### 7. Verify and open the app

```bash
curl http://localhost:3001/api/health
# {"ok":true,"workerConnected":true}
```

Open [http://localhost:5173](http://localhost:5173), upload a PDF, and follow the job link.

### Optional: test the worker without the server

```bash
cd worker
source .venv/bin/activate
python test_local.py /path/to/document.pdf
```

This runs the full PDF → extract → LLM → JSON pipeline without the server or WebSocket.

## Project structure

```
doc-tidy/
├── client/           Vite + React + TypeScript (UI)
├── server/           Express + TypeScript (API, WebSocket, SSE)
├── worker/           Python worker (PDF extraction + LLM streaming)
├── design-log/       Architecture decision records
├── docker-compose.yml
└── railway.json      Railway build/deploy config
```

Architecture details: [design-log/2026-06-19-architecture.md](design-log/2026-06-19-architecture.md)

## API (server)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check; includes `workerConnected` |
| `POST` | `/api/upload` | Upload PDF; returns job ID |
| `GET` | `/api/jobs/:id` | Job status and result |
| `POST` | `/api/jobs/:id/rerun` | Re-process an existing job |
| `POST` | `/api/jobs/:id/correct` | Submit a corrected output; stored + embedded for retrieval |
| `GET` | `/api/stream/:id` | SSE stream of thinking/output tokens |
| `GET` | `/api/vendors` | List vendor profiles |
| `GET` | `/api/vendors/:name` | Get a vendor profile by name |
| `POST` | `/api/vendors` | Create/update a vendor profile (one-time setup; scopes corrections to the vendor) |
| `WS` | `/ws` | Worker connection (not used by browser) |

## Production deployment

### Railway (server + client)

This repo includes `railway.json`:

- **Build:** `npm install --include=dev && npm run build`
- **Start:** `node server/dist/index.js`
- **Health check:** `/api/health`

Steps:

1. Push to GitHub and connect the repo in Railway.
2. Set env vars from `server/.env.example` (use your MongoDB Atlas URI).
3. Set `CLIENT_ORIGIN` to your Railway domain (or `*`).
4. Note the public URL for the worker's `SERVER_WS_URL` (`wss://…/ws`).

### Worker (Ubuntu)

#### 1. Clone and set up the venv

```bash
git clone https://github.com/jomael-gemota/doc-tidy.git
cd doc-tidy/worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

#### 2. Configure the LLM backend

**Option A — Hermes Agent (recommended)**

Hermes Agent is the Nous Research autonomous agent framework. It wraps any LLM backend and exposes an OpenAI-compatible API server.

1. Install Hermes Agent if not already: see [hermes-agent.nousresearch.com](https://hermes-agent.nousresearch.com)
2. Set the model (e.g. GPT-5.5):
   ```bash
   hermes model   # select your preferred model
   ```
3. Enable the API server:
   ```bash
   hermes config set API_SERVER_ENABLED true
   hermes config set API_SERVER_KEY your-secret-key
   ```
4. Start the gateway:
   ```bash
   hermes gateway
   ```
5. Verify it's running:
   ```bash
   curl http://localhost:8642/health   # should return {"status":"ok"}
   ```
6. Set in `worker/.env`:
   ```
   HERMES_BASE_URL=http://localhost:8642/v1
   HERMES_MODEL=hermes-agent
   HERMES_API_KEY=your-secret-key
   ```

**Option B — OpenAI API directly**

```
HERMES_BASE_URL=          # leave blank
HERMES_MODEL=gpt-5.5
HERMES_API_KEY=sk-your-openai-key
```

**Option C — Local Ollama model**

```bash
ollama pull hermes3
```

```
HERMES_BASE_URL=http://localhost:11434/v1
HERMES_MODEL=hermes3
HERMES_API_KEY=ollama
```

#### 3. Create `worker/.env`

```bash
cp worker/.env.example worker/.env
# Fill in HERMES_*, MONGODB_URI, and SERVER_WS_URL
```

#### 4. Run the worker

```bash
python worker.py
```

#### 5. Run as a systemd service (optional — auto-start on boot)

1. Copy the worker directory to your Ubuntu machine (e.g. `/opt/doc-tidy/worker`).
2. Install dependencies into a venv.
3. Create `worker/.env` with your LLM config, MongoDB Atlas URI, and the Railway WSS URL.
4. Create a systemd service:

```ini
[Unit]
Description=Doc Tidy Worker
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/doc-tidy/worker
ExecStart=/opt/doc-tidy/worker/.venv/bin/python worker.py
EnvironmentFile=/opt/doc-tidy/worker/.env
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now doc-tidy-worker
```

#### 6. Updating the worker after a code change

The worker runs on your Ubuntu machine and does **not** auto-deploy (only the Railway
server/client does). After new commits are pushed, update and restart it manually:

```bash
cd ~/Github/doc-tidy        # the directory the service actually runs from
git pull
sudo systemctl daemon-reload   # only needed if the .service unit changed (clears the
                               #   "unit file changed on disk" warning)
sudo systemctl restart doc-tidy-worker
```

Confirm the restart actually took effect:

```bash
systemctl show doc-tidy-worker -p ActiveState -p ExecMainStartTimestamp
# Want: ActiveState=active  and  ExecMainStartTimestamp = just now
```

> **Important — the service must run from the directory you pulled.** Check the unit's path:
>
> ```bash
> systemctl show doc-tidy-worker -p WorkingDirectory -p ExecStart
> ```
>
> If `WorkingDirectory`/`ExecStart` point somewhere other than your `git pull` directory
> (e.g. `/opt/doc-tidy/worker` vs `/home/<user>/Github/doc-tidy/worker`), the restart relaunches
> **stale code**. Either pull in that directory too, or edit the unit (`sudo systemctl edit
> --full doc-tidy-worker`) so the paths match your clone, then `daemon-reload` and `restart`.
>
> Quick sanity check that the live file has the latest code:
>
> ```bash
> grep -n "Fetching PDF from storage" worker/worker.py   # should print a line
> ```

Tail the logs to confirm a clean connection and watch a job process:

```bash
journalctl -u doc-tidy-worker -n 80 --no-pager -f
```

> Reprocessing note: existing jobs are **not** reprocessed. A job's reasoning is recorded only
> while it runs, so jobs completed before an update keep whatever they stored (e.g. a blank
> reasoning panel). Upload a **new** document to see the effect of a worker update.

## Environment variables

### server/.env

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017` |
| `MONGODB_DB` | Database name | `doc-tidy` |
| `PORT` | HTTP port | `3001` |
| `NODE_ENV` | `development` or `production` | `development` |
| `CLIENT_ORIGIN` | CORS allowed origin | `http://localhost:5173` |
| `OPENAI_API_KEY` | Key for embedding corrections (optional; corrections stored without it just aren't retrievable) | — |
| `EMBEDDING_MODEL` | Embedding model; must match the worker | `text-embedding-3-small` |

### worker/.env

| Variable | Description | Example |
|----------|-------------|---------|
| `HERMES_BASE_URL` | LLM endpoint — Hermes Agent, Ollama, or OpenAI. Leave blank for OpenAI default. | `http://localhost:8642/v1` |
| `HERMES_MODEL` | Model name at the endpoint | `hermes-agent` / `gpt-5.5` / `hermes3` |
| `HERMES_API_KEY` | API key for the endpoint | your key |
| `MONGODB_URI` | Same MongoDB URI as server | |
| `MONGODB_DB` | Same database name | `doc-tidy` |
| `SERVER_WS_URL` | WebSocket URL of the Express server | `ws://localhost:3001/ws` |
| `MAX_DOCUMENT_CHARS` | Max chars sent to the model (default 40000) | `40000` |
| `REQUEST_TIMEOUT` | HTTP timeout in seconds for LLM calls (default 120) | `120` |
| `MAX_TOKENS` | Max tokens the model may generate (default 8192) | `8192` |
| `OCR_ENABLED` | Read scanned pages with local Tesseract (default true) | `true` |
| `OCR_DPI` | Rasterization DPI for OCR (default 300) | `300` |
| `SCANNED_TEXT_THRESHOLD` | Below this many chars, a page is treated as scanned | `20` |
| `OPENAI_API_KEY` | Key for embedding documents during correction retrieval | — |
| `EMBEDDING_MODEL` | Embedding model; must match the server | `text-embedding-3-small` |
| `CORRECTIONS_ENABLED` | Inject retrieved corrections as few-shot examples (default true) | `true` |
| `CORRECTION_TOP_K` | Max correction examples injected per job | `3` |
| `CORRECTION_MIN_SCORE` | Cosine similarity threshold for retrieval | `0.75` |

### Learning loop & vendors (MongoDB)

Two collections back the learning loop, created automatically on first write in
your existing cluster:

- **`vendors`** — `{ name, normalizedName, skuSamples, … }`. When Tidy sees a new
  vendor it flags the job; the UI prompts the user to paste **one real sample SKU**.
  Tidy uses the sample(s) as cold-start format anchors — it reproduces those exact
  shapes for the vendor's rows from the very first run — and registering the vendor
  also scopes corrections to it so formats are remembered and refined. A vendor can
  hold **several** samples (different SKU formats): once set up, the card collapses
  into an "Add another sample SKU" link. (Legacy single `skuSample` is still read,
  and `skuInitial`/`skuFormat` may persist on older records but are unused; see
  [design-log/2026-06-26-multiple-vendor-sku-samples.md](design-log/2026-06-26-multiple-vendor-sku-samples.md),
  [design-log/2026-06-26-vendor-setup-sample-sku.md](design-log/2026-06-26-vendor-setup-sample-sku.md),
  and [design-log/2026-06-25-llm-built-skus-per-vendor.md](design-log/2026-06-25-llm-built-skus-per-vendor.md).)
- **`corrections`** — your edits to a job's output, embedded for retrieval.
  Similar future documents inject the most relevant ones as few-shot examples;
  a known vendor's corrections are always retrieved for it, so a learned SKU
  format is remembered indefinitely.

Local OCR needs system packages on the worker box:

```bash
sudo apt install tesseract-ocr poppler-utils   # Ubuntu
```

> **Scale note:** retrieval scores corrections in-process (fine for sparse
> per-vendor corrections). To scale to large correction volumes, add a MongoDB
> Atlas Vector Search index on `corrections.embedding` and swap the
> `retrieve_examples` implementation — the interface is stable.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Upload succeeds but nothing happens | Worker not connected | Start worker; check `/api/health` |
| `503` on upload | Worker not connected | Same as above — server rejects uploads when no worker is registered |
| CORS errors in browser | Wrong `CLIENT_ORIGIN` | Match your dev or Railway URL |
| Worker won't connect | Wrong `SERVER_WS_URL` | Use `wss://` in production |
| Empty or failed JSON | LLM timeout or bad output | Tune `REQUEST_TIMEOUT`, `MAX_TOKENS`; test with `test_local.py` |
| Mongo errors | URI mismatch | Server and worker must use the same `MONGODB_URI` and `MONGODB_DB` |
| Reasoning panel blank (JSON works) | Worker running stale code, or the unit's path differs from where you pulled | Update + restart the worker (see [Updating the worker](#6-updating-the-worker-after-a-code-change)); verify with `grep`; upload a **new** document (old jobs stay blank) |

## Development

```bash
npm run check
```

Runs TypeScript typecheck (client + server) and ESLint (client).

## License

See [LICENSE](LICENSE) (MIT).
