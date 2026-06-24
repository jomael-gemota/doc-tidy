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
router.post('/', async (req, res) => {
  try {
    const { name, skuInitial, skuFormat } = req.body as {
      name?: unknown
      skuInitial?: unknown
      skuFormat?: unknown
    }

    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'name is required' })
      return
    }
    if (typeof skuInitial !== 'string' || !skuInitial.trim()) {
      res.status(400).json({ error: 'skuInitial is required' })
      return
    }
    if (skuFormat !== undefined && skuFormat !== null && typeof skuFormat !== 'string') {
      res.status(400).json({ error: 'skuFormat must be a string' })
      return
    }

    const vendor = await upsertVendor(
      name.trim(),
      skuInitial.trim(),
      (skuFormat as string | null | undefined) ?? null,
    )
    res.json(vendor)
  } catch (err) {
    console.error('[vendors] upsert error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
