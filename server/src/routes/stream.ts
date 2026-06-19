import { Router } from 'express'
import { getJob } from '../lib/mongodb.js'
import { registry } from '../lib/worker-registry.js'

const router = Router()

router.get('/:id', async (req, res) => {
  const jobId = req.params.id

  try {
    const job = await getJob(jobId)
    if (!job) {
      res.status(404).json({ error: 'Job not found' })
      return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    // Replay any thinking already accumulated (e.g. client reconnect)
    if (job.thinking) {
      const payload = `event: thinking\ndata: ${JSON.stringify({ type: 'thinking', content: job.thinking })}\n\n`
      res.write(payload)
    }

    if (job.status === 'completed' && job.jsonOutput) {
      res.write(`event: done\ndata: ${JSON.stringify({ type: 'done', json: job.jsonOutput })}\n\n`)
      res.end()
      return
    }

    if (job.status === 'failed') {
      res.write(`event: error\ndata: ${JSON.stringify({ type: 'error', message: job.error ?? 'Job failed' })}\n\n`)
      res.end()
      return
    }

    registry.addSseClient(jobId, res)

    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n')
      } catch {
        clearInterval(heartbeat)
      }
    }, 20000)

    req.on('close', () => {
      clearInterval(heartbeat)
      registry.removeSseClient(jobId, res)
    })
  } catch (err) {
    console.error('[stream] error:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
})

export default router
