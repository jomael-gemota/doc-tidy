import { Router } from 'express'
import { listVendors, getVendorByName, upsertVendor } from '../lib/mongodb.js'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    res.json(await listVendors())
  } catch (err) {
    console.error('[vendors] list error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:name', async (req, res) => {
  try {
    const vendor = await getVendorByName(req.params.name)
    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found' })
      return
    }
    res.json(vendor)
  } catch (err) {
    console.error('[vendors] get error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Create or update a vendor's SKU profile (the one-time setup for new vendors).
// The user pastes one real sample SKU; Tidy learns the vendor's format from it.
router.post('/', async (req, res) => {
  try {
    const { name, skuSample } = req.body as {
      name?: unknown
      skuSample?: unknown
    }

    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'name is required' })
      return
    }
    if (typeof skuSample !== 'string' || !skuSample.trim()) {
      res.status(400).json({ error: 'skuSample is required' })
      return
    }

    const vendor = await upsertVendor(name.trim(), skuSample.trim())
    res.json(vendor)
  } catch (err) {
    console.error('[vendors] upsert error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
