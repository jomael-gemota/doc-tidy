import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import path from 'path'
import { fileURLToPath } from 'url'
import { getDb, updateJob, getPdfBuffer, appendThinking } from './lib/mongodb.js'
import { registry } from './lib/worker-registry.js'
import uploadRouter from './routes/upload.js'
import jobsRouter from './routes/jobs.js'
import streamRouter from './routes/stream.js'
import { ObjectId } from 'mongodb'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT ?? '3001', 10)
const CLIENT_BUILD = path.resolve(__dirname, '../../client/dist')

const app = express()
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'
app.use(cors({ origin: clientOrigin === '*' ? true : clientOrigin }))
app.use(express.json())

app.use('/api/upload', uploadRouter)
app.use('/api/jobs', jobsRouter)
app.use('/api/stream', streamRouter)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, workerConnected: registry.hasWorker() })
})

// Serve Vite build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(CLIENT_BUILD))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(CLIENT_BUILD, 'index.html'))
  })
}

const httpServer = createServer(app)

// WebSocket server — Worker connects here
const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

wss.on('connection', ws => {
  registry.setWorker(ws)

  ws.on('message', async raw => {
    let msg: Record<string, unknown>
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      console.warn('[ws] received non-JSON message')
      return
    }

    const { type, jobId } = msg as { type: string; jobId: string }

    if (type === 'token') {
      const { content, tokenType } = msg as { content: string; tokenType: 'thinking' | 'output' }
      // Persist thinking tokens to MongoDB
      if (tokenType === 'thinking') {
        await appendThinking(jobId, content)
      }
      registry.pushToJob(jobId, { type: tokenType, content })
    }

    if (type === 'status') {
      const { status } = msg as { status: string }
      await updateJob(jobId, { status: status as 'processing' | 'completed' | 'failed' })
      registry.pushToJob(jobId, { type: 'status', status })
    }

    if (type === 'complete') {
      const { json } = msg as { json: Record<string, unknown> }
      await updateJob(jobId, {
        status: 'completed',
        jsonOutput: json,
        completedAt: new Date(),
      })
      registry.pushToJob(jobId, { type: 'done', json })
    }

    if (type === 'error') {
      const { message } = msg as { message: string }
      await updateJob(jobId, { status: 'failed', error: message })
      registry.pushToJob(jobId, { type: 'error', message })
    }

    if (type === 'ready') {
      // Worker announces it is ready to accept jobs — send any pending jobs
      const db = await getDb()
      const pendingJobs = await db
        .collection('jobs')
        .find({ status: 'pending' })
        .toArray()

      for (const job of pendingJobs) {
        registry.sendToWorker({ type: 'job', jobId: (job._id as ObjectId).toString() })
      }
    }
  })
})

async function start() {
  await getDb()
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] listening on http://0.0.0.0:${PORT}`)
    console.log(`[server] WebSocket endpoint: ws://0.0.0.0:${PORT}/ws`)
  })
}

start().catch(err => {
  console.error('[server] failed to start:', err)
  process.exit(1)
})
