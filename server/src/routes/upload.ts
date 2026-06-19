import { Router } from 'express'
import multer from 'multer'
import { createJob, storePdf, updateJob } from '../lib/mongodb.js'
import { registry } from '../lib/worker-registry.js'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Only PDF files are accepted'))
    }
  },
})

router.post('/', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No PDF file provided' })
      return
    }

    if (!registry.hasWorker()) {
      res.status(503).json({ error: 'Processing worker is not connected. Please try again shortly.' })
      return
    }

    const jobId = await createJob(req.file.originalname)
    const jobIdStr = jobId.toString()

    const fileId = await storePdf(jobIdStr, req.file.originalname, req.file.buffer)
    await updateJob(jobIdStr, { pdfFileId: fileId, status: 'pending' })

    const dispatched = registry.sendToWorker({ type: 'job', jobId: jobIdStr })
    if (!dispatched) {
      res.status(503).json({ error: 'Failed to dispatch job to worker' })
      return
    }

    res.json({ jobId: jobIdStr })
  } catch (err) {
    console.error('[upload] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
