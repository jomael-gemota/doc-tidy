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

```bash
cd worker
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python worker.py
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

1. Copy the worker directory to your Ubuntu machine.
2. Install dependencies into a venv.
3. Create `worker/.env` with your OpenAI key, MongoDB Atlas URI, and the Railway WSS URL.
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
| `HERMES_BASE_URL` | Ollama's OpenAI-compatible endpoint | `http://localhost:11434/v1` |
| `HERMES_MODEL` | Model name as loaded in Ollama | `hermes3` |
| `HERMES_API_KEY` | Ollama does not require a real key — use `ollama` | `ollama` |
| `MONGODB_URI` | Same MongoDB URI as server | |
| `MONGODB_DB` | Same database name | `doc-tidy` |
| `SERVER_WS_URL` | WebSocket URL of the Express server | `ws://localhost:3001/ws` |

## Quality Check

```bash
npm run check
```

This runs TypeScript type checking across both packages.
