import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { listCorrections, deleteCorrection } from '../lib/mongodb.js'

const router = Router()

// List every correction newest-first (embedding stripped by listCorrections).
// The Vendors page groups these client-side by normalized vendor name.
router.get('/', async (_req, res) => {
  try {
    res.json(await listCorrections(1000))
  } catch (err) {
    console.error('[corrections] list error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Permanently delete a correction. The worker reads corrections fresh on each
// run, so the removed example stops influencing Tidy from the next run onward —
// no worker sync is required.
router.delete('/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid correction id' })
      return
    }
    const deleted = await deleteCorrection(req.params.id)
    if (!deleted) {
      res.status(404).json({ error: 'Correction not found' })
      return
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('[corrections] delete error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
