import { MongoClient, GridFSBucket, ObjectId, type Db } from 'mongodb'
import { Readable } from 'stream'

let client: MongoClient | null = null
let db: Db | null = null

export async function getDb(): Promise<Db> {
  if (db) return db

  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI environment variable is not set')

  client = new MongoClient(uri)
  await client.connect()
  db = client.db(process.env.MONGODB_DB ?? 'doc-tidy')
  console.log('[mongodb] connected to', db.databaseName)
  return db
}

export interface JobDocument {
  _id?: ObjectId
  status: 'pending' | 'processing' | 'completed' | 'failed'
  filename: string
  pdfFileId: ObjectId | null
  thinking: string
  jsonOutput: Record<string, unknown> | null
  tableOutput: Record<string, unknown> | null
  // Vendor identification (set by the worker after extraction).
  vendorName?: string | null
  vendorNeedsSetup?: boolean
  // Truncated source text used for correction embeddings/retrieval.
  documentTextSample?: string
  error: string | null
  createdAt: Date
  completedAt: Date | null
  // Derived (not stored): number of corrections recorded for this job. Populated
  // by listJobs so the batch table can flag documents with no corrections yet.
  correctionCount?: number
}

// Per-vendor profile. `skuSamples` are real, user-provided SKUs for the vendor;
// Tidy uses them as cold-start format anchors and reproduces those shapes for the
// vendor's rows (see design-log/2026-06-26-multiple-vendor-sku-samples.md).
// `skuSample` (single) is legacy and still read as an extra sample for
// backward compatibility; `skuInitial`/`skuFormat` are older registration
// metadata. Nothing assembles SKUs from any of these anymore.
export interface VendorDocument {
  _id?: ObjectId
  name: string
  normalizedName: string
  skuSamples?: string[]
  skuSample?: string | null
  skuInitial?: string | null
  skuFormat?: string | null
  createdAt: Date
  updatedAt: Date
}

// A user correction of a job's extracted output. The embedding indexes the
// source document so future similar documents can retrieve this as a few-shot
// example (see design-log/2026-06-25-sku-extraction-learning-system.md).
export interface CorrectionDocument {
  _id?: ObjectId
  jobId: ObjectId
  filename: string
  vendorName: string | null
  documentTextSample: string
  embedding: number[] | null
  originalOutput: Record<string, unknown> | null
  correctedOutput: Record<string, unknown>
  note?: string
  createdAt: Date
}

// Canonical key for vendor matching: lowercased, collapsed whitespace.
// Must mirror normalize_vendor_name() in worker/sku.py.
export function normalizeVendorName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export async function createJob(filename: string): Promise<ObjectId> {
  const database = await getDb()
  const doc: JobDocument = {
    status: 'pending',
    filename,
    pdfFileId: null,
    thinking: '',
    jsonOutput: null,
    tableOutput: null,
    error: null,
    createdAt: new Date(),
    completedAt: null,
  }
  const result = await database.collection<JobDocument>('jobs').insertOne(doc)
  return result.insertedId
}

export async function getJob(jobId: string): Promise<JobDocument | null> {
  const database = await getDb()
  return database.collection<JobDocument>('jobs').findOne({ _id: new ObjectId(jobId) })
}

// List jobs (batches) newest-first. The large streaming `thinking` field is projected
// out to keep the payload small; `jsonOutput` is kept so the UI can render it on demand.
// Each job is annotated with `correctionCount` (joined from the corrections
// collection) so the batch table can flag documents with no corrections yet.
export async function listJobs(limit = 200): Promise<JobDocument[]> {
  const database = await getDb()
  return database
    .collection<JobDocument>('jobs')
    .aggregate<JobDocument>([
      { $sort: { createdAt: -1 } },
      { $limit: limit },
      { $project: { thinking: 0 } },
      {
        $lookup: {
          from: 'corrections',
          localField: '_id',
          foreignField: 'jobId',
          as: '_corrections',
        },
      },
      { $addFields: { correctionCount: { $size: '$_corrections' } } },
      { $project: { _corrections: 0 } },
    ])
    .toArray()
}

export async function updateJob(
  jobId: string,
  update: Partial<JobDocument>,
): Promise<void> {
  const database = await getDb()
  await database
    .collection<JobDocument>('jobs')
    .updateOne({ _id: new ObjectId(jobId) }, { $set: update })
}

export async function deleteJob(jobId: string): Promise<void> {
  const database = await getDb()
  await database.collection<JobDocument>('jobs').deleteOne({ _id: new ObjectId(jobId) })
}

// Wipes accumulated output so the worker can process the job fresh.
// The original PDF in GridFS is intentionally kept — pdfFileId is preserved.
export async function resetJobForRerun(jobId: string): Promise<void> {
  const database = await getDb()
  await database.collection<JobDocument>('jobs').updateOne(
    { _id: new ObjectId(jobId) },
    {
      $set: {
        status: 'pending',
        thinking: '',
        jsonOutput: null,
        tableOutput: null,
        error: null,
        completedAt: null,
      },
    },
  )
}

export async function appendThinking(jobId: string, chunk: string): Promise<void> {
  const database = await getDb()
  // Use an aggregation pipeline update so we can $concat the string in-place.
  // $push would fail because thinking is initialized as a string, not an array.
  await database
    .collection<JobDocument>('jobs')
    .updateOne(
      { _id: new ObjectId(jobId) },
      [{ $set: { thinking: { $concat: ['$thinking', chunk] } } }] as never,
    )
}

export async function storePdf(
  jobId: string,
  filename: string,
  buffer: Buffer,
): Promise<ObjectId> {
  const database = await getDb()
  const bucket = new GridFSBucket(database, { bucketName: 'pdfs' })

  return new Promise<ObjectId>((resolve, reject) => {
    const readable = Readable.from(buffer)
    const uploadStream = bucket.openUploadStream(filename, {
      metadata: { jobId },
    })
    readable.pipe(uploadStream)
    uploadStream.on('finish', () => resolve(uploadStream.id as ObjectId))
    uploadStream.on('error', reject)
  })
}

export async function getPdfBuffer(fileId: ObjectId): Promise<Buffer> {
  const database = await getDb()
  const bucket = new GridFSBucket(database, { bucketName: 'pdfs' })
  const chunks: Buffer[] = []

  return new Promise<Buffer>((resolve, reject) => {
    const downloadStream = bucket.openDownloadStream(fileId)
    downloadStream.on('data', (chunk: Buffer) => chunks.push(chunk))
    downloadStream.on('end', () => resolve(Buffer.concat(chunks)))
    downloadStream.on('error', reject)
  })
}

// ─── Vendors ─────────────────────────────────────────────────────────────────

export async function listVendors(): Promise<VendorDocument[]> {
  const database = await getDb()
  return database
    .collection<VendorDocument>('vendors')
    .find({})
    .sort({ name: 1 })
    .toArray()
}

export async function getVendorByName(name: string): Promise<VendorDocument | null> {
  const database = await getDb()
  return database
    .collection<VendorDocument>('vendors')
    .findOne({ normalizedName: normalizeVendorName(name) })
}

// Append a sample SKU to a vendor (keyed by normalized name), creating the
// vendor on first add. Samples are deduplicated; Tidy learns the vendor's
// format(s) from them. Returns the updated vendor document.
export async function addVendorSkuSample(
  name: string,
  skuSample: string,
): Promise<VendorDocument> {
  const database = await getDb()
  const normalizedName = normalizeVendorName(name)
  const now = new Date()
  await database.collection<VendorDocument>('vendors').updateOne(
    { normalizedName },
    {
      $set: { name, updatedAt: now },
      $addToSet: { skuSamples: skuSample },
      $setOnInsert: { normalizedName, createdAt: now },
    },
    { upsert: true },
  )
  const vendor = await database
    .collection<VendorDocument>('vendors')
    .findOne({ normalizedName })
  return vendor as VendorDocument
}

// Remove a sample SKU from a vendor. Pulls it from `skuSamples` and also clears
// the legacy single `skuSample` when it matches, so the next worker run no longer
// anchors on the removed format. Returns the updated vendor (or null if unknown).
export async function removeVendorSkuSample(
  name: string,
  skuSample: string,
): Promise<VendorDocument | null> {
  const database = await getDb()
  const normalizedName = normalizeVendorName(name)
  const collection = database.collection<VendorDocument>('vendors')
  const now = new Date()
  await collection.updateOne(
    { normalizedName },
    { $pull: { skuSamples: skuSample }, $set: { updatedAt: now } },
  )
  // Drop the legacy single value too if it was the removed sample.
  await collection.updateOne(
    { normalizedName, skuSample },
    { $set: { skuSample: null, updatedAt: now } },
  )
  return collection.findOne({ normalizedName })
}

// ─── Corrections ─────────────────────────────────────────────────────────────

export async function createCorrection(
  doc: Omit<CorrectionDocument, '_id' | 'createdAt'>,
): Promise<ObjectId> {
  const database = await getDb()
  const result = await database
    .collection<CorrectionDocument>('corrections')
    .insertOne({ ...doc, createdAt: new Date() } as CorrectionDocument)
  return result.insertedId
}

export async function listCorrections(limit = 200): Promise<CorrectionDocument[]> {
  const database = await getDb()
  return database
    .collection<CorrectionDocument>('corrections')
    .find({}, { projection: { embedding: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()
}
