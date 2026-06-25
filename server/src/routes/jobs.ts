import { Router } from 'express'
import { ObjectId } from 'mongodb'
import {
  getJob,
  listJobs,
  deleteJob,
  resetJobForRerun,
  createCorrection,
  listCorrectionsForJob,
} from '../lib/mongodb.js'
import { embedText } from '../lib/embeddings.js'
import { registry } from '../lib/worker-registry.js'

const router = Router()

// Stable, key-order-independent serialization so two corrections with the same
// content (but differing key order) compare equal for duplicate detection.
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize(obj[key])
        return acc
      }, {})
  }
  return value
}

const canonicalJson = (value: unknown): string => JSON.stringify(canonicalize(value))

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

// List the corrections recorded for a job, newest-first. The UI uses this to
// re-render the persisted before/after diff after a page refresh.
router.get('/:id/corrections', async (req, res) => {
  try {
    const corrections = await listCorrectionsForJob(req.params.id)
    res.json(corrections)
  } catch (err) {
    console.error('[jobs] list corrections error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Capture a user correction of a job's extracted output. Stores the corrected
// JSON plus an embedding of the source document so future similar documents can
// retrieve it as a few-shot example. Identical corrections (same correctedOutput
// AND same note for the same job) are not stored twice — the existing one is
// returned instead.
router.post('/:id/correct', async (req, res) => {
  try {
    const { correctedOutput, note, mode, correctedTables } = req.body as {
      correctedOutput?: unknown
      note?: unknown
      mode?: unknown
      correctedTables?: unknown
    }

    if (!correctedOutput || typeof correctedOutput !== 'object' || Array.isArray(correctedOutput)) {
      res.status(400).json({ error: 'correctedOutput must be a JSON object' })
      return
    }
    if (note !== undefined && typeof note !== 'string') {
      res.status(400).json({ error: 'note must be a string' })
      return
    }
    if (mode !== undefined && mode !== 'json' && mode !== 'tabular') {
      res.status(400).json({ error: "mode must be 'json' or 'tabular'" })
      return
    }
    if (correctedTables !== undefined && !Array.isArray(correctedTables)) {
      res.status(400).json({ error: 'correctedTables must be an array' })
      return
    }

    const job = await getJob(req.params.id)
    if (!job) {
      res.status(404).json({ error: 'Job not found' })
      return
    }

    const normalizedNote = typeof note === 'string' && note.trim() ? note.trim() : undefined

    // Reject exact duplicates: a correction is a duplicate only when both the
    // corrected output AND the note match an existing one for this job. The same
    // output with a different note is a distinct correction (the note carries
    // learning-loop signal).
    const existing = await listCorrectionsForJob(req.params.id)
    const target = canonicalJson(correctedOutput)
    const duplicate = existing.find(
      c =>
        canonicalJson(c.correctedOutput) === target &&
        (c.note ?? undefined) === normalizedNote,
    )
    if (duplicate) {
      res.json({
        ok: true,
        duplicate: true,
        correctionId: duplicate._id?.toString(),
      })
      return
    }

    const documentTextSample = job.documentTextSample ?? ''
    const embedding = documentTextSample ? await embedText(documentTextSample) : null

    const correctionId = await createCorrection({
      jobId: new ObjectId(req.params.id),
      filename: job.filename,
      vendorName: job.vendorName ?? null,
      documentTextSample,
      embedding,
      originalOutput: job.jsonOutput,
      correctedOutput: correctedOutput as Record<string, unknown>,
      mode: mode as 'json' | 'tabular' | undefined,
      correctedTables: Array.isArray(correctedTables) ? correctedTables : undefined,
      note: normalizedNote,
    })

    res.json({
      ok: true,
      duplicate: false,
      correctionId: correctionId.toString(),
      embedded: embedding !== null,
    })
  } catch (err) {
    console.error('[jobs] correct error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
