import { Router } from 'express'
import { getJob, listJobs } from '../lib/mongodb.js'

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

export default router
