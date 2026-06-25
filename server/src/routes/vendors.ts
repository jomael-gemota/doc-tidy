import { Router } from 'express'
import {
  listVendors,
  getVendorByName,
  addVendorSkuSample,
  removeVendorSkuSample,
} from '../lib/mongodb.js'

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

// Add a sample SKU to a vendor (creating it on first add). The user pastes one
// real sample at a time; Tidy learns the vendor's format(s) from them. A vendor
// may have several samples to cover different SKU formats.
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

    const vendor = await addVendorSkuSample(name.trim(), skuSample.trim())
    res.json(vendor)
  } catch (err) {
    console.error('[vendors] upsert error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Remove one sample SKU from a vendor. The worker reads samples fresh on each
// run, so the removed format stops anchoring Tidy from the next run onward.
router.delete('/:name/sample', async (req, res) => {
  try {
    const { skuSample } = req.body as { skuSample?: unknown }
    if (typeof skuSample !== 'string' || !skuSample.trim()) {
      res.status(400).json({ error: 'skuSample is required' })
      return
    }

    const vendor = await removeVendorSkuSample(req.params.name, skuSample.trim())
    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found' })
      return
    }
    res.json(vendor)
  } catch (err) {
    console.error('[vendors] remove sample error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
