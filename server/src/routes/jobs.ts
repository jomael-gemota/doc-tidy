import { Router } from 'express'
import { getJob, listJobs, deleteJob, resetJobForRerun } from '../lib/mongodb.js'
import { registry } from '../lib/worker-registry.js'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const jobs = await listJobs()
    res.json(jobs)
  } catch (err) {
    console.error('[jobs] list error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const job = await getJob(req.params.id)
    if (!job) {
      res.status(404).json({ error: 'Job not found' })
      return
    }
    res.json(job)
  } catch (err) {
    console.error('[jobs] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const job = await getJob(req.params.id)
    if (!job) {
      res.status(404).json({ error: 'Job not found' })
      return
    }
    await deleteJob(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    console.error('[jobs] delete error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/rerun', async (req, res) => {
  try {
    const job = await getJob(req.params.id)
    if (!job) {
      res.status(404).json({ error: 'Job not found' })
      return
    }

    if (!job.pdfFileId) {
      res.status(422).json({ error: 'No PDF stored for this job — cannot re-run' })
      return
    }

    if (!registry.hasWorker()) {
      res.status(503).json({ error: 'Processing worker is not connected. Please try again shortly.' })
      return
    }

    await resetJobForRerun(req.params.id)

    const dispatched = registry.sendToWorker({ type: 'job', jobId: req.params.id })
    if (!dispatched) {
      res.status(503).json({ error: 'Failed to dispatch job to worker' })
      return
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('[jobs] rerun error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
