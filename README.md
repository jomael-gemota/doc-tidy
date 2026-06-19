# Doc Tidy

AI-powered tool that converts PDFs into structured JSON — watch the agent think in real time.

## Architecture

```
Browser (Vite/React) ──SSE──▶ Express Server (Railway)
                                     │ WebSocket
                               Python Worker (Ubuntu)
                                     │ OpenAI API
                               Tidy Agent (GPT-5.5)

All tiers share MongoDB Atlas (GridFS for PDFs, jobs collection for state)
```

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| Python | ≥ 3.11 |
| Docker | any recent |

## Quick Start (Local Development)

### 1. Start MongoDB

```bash
docker compose up -d
```

### 2. Install Node.js dependencies

```bash
npm install           # installs both client/ and server/ workspaces
```

### 3. Configure the server

```bash
cp server/.env.example server/.env
# Edit server/.env — defaults work for local Docker MongoDB
```

### 4. Configure the worker

```bash
cp worker/.env.example worker/.env
# Edit worker/.env and set your OPENAI_API_KEY
```

### 5. Start the server and client (separate terminals)

```bash
# Terminal 1 — Express server
npm run dev --workspace=server

# Terminal 2 — Vite dev server
npm run dev --workspace=client
```

Or use the root convenience script:

```bash
npm run dev
```

### 6. Start the worker (Ubuntu / any Python 3.11+ machine)

> **Note:** Ubuntu 24.04+ protects the system Python. Always use a virtual environment.

```bash
cd worker
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python worker.py
```

Re-activating in a new terminal:

```bash
cd ~/Github/doc-tidy/worker
source .venv/bin/activate
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```
doc-tidy/
├── client/         Vite + React + TypeScript (UI)
├── server/         Express + TypeScript (API, WebSocket, SSE)
├── worker/         Python 3.11 worker (PDF extraction + OpenAI streaming)
├── design-log/     Architecture decision records
└── docker-compose.yml
```

## Production Deployment

### Railway (Server + Client)

1. Push to GitHub.
2. Create a Railway project and connect the repo.
3. Set the **Start Command** to `npm run build && npm run start --workspace=server`.
4. Add environment variables from `server/.env.example` (use your MongoDB Atlas URI).
5. Railway will auto-assign a domain — note it for the worker.

### Worker (Ubuntu)

#### 1. Clone and set up the venv

```bash
git clone https://github.com/jomael-gemota/doc-tidy.git ~/Github/doc-tidy
cd ~/Github/doc-tidy/worker
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

#### 4. Test the pipeline locally (optional but recommended)

```bash
cd ~/Github/doc-tidy/worker
source .venv/bin/activate
python test_local.py /path/to/invoice.pdf
```

This runs the full PDF → extract → LLM → JSON pipeline without the server or WebSocket.

#### 5. Run the worker

```bash
python worker.py
```

#### 6. Run as a systemd service (optional — auto-start on boot)

1. Copy the worker directory to your Ubuntu machine.
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

## Environment Variables

### server/.env

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017` |
| `MONGODB_DB` | Database name | `doc-tidy` |
| `PORT` | HTTP port | `3001` |
| `NODE_ENV` | `development` or `production` | `development` |
| `CLIENT_ORIGIN` | CORS allowed origin | `http://localhost:5173` |

### worker/.env

| Variable | Description | Example |
|----------|-------------|---------|
| `HERMES_BASE_URL` | LLM endpoint — Hermes Agent, Ollama, or OpenAI. Leave blank for OpenAI default. | `http://localhost:8642/v1` |
| `HERMES_MODEL` | Model name at the endpoint | `hermes-agent` / `gpt-5.5` / `hermes3` |
| `HERMES_API_KEY` | API key for the endpoint | your key |
| `MONGODB_URI` | Same MongoDB URI as server | |
| `MONGODB_DB` | Same database name | `doc-tidy` |
| `SERVER_WS_URL` | WebSocket URL of the Express server | `ws://localhost:3001/ws` |
| `MAX_DOCUMENT_CHARS` | Max chars sent to the model (default 12000) | `12000` |
| `REQUEST_TIMEOUT` | HTTP timeout in seconds for LLM calls (default 90) | `90` |
| `MAX_TOKENS` | Max tokens the model may generate (default 2048) | `2048` |

## Quality Check

```bash
npm run check
```

This runs TypeScript type checking across both packages.
