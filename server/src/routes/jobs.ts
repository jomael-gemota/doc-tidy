import { Router } from 'express'
import { getJob } from '../lib/mongodb.js'

const router = Router()

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
