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
  error: string | null
  createdAt: Date
  completedAt: Date | null
}

export async function createJob(filename: string): Promise<ObjectId> {
  const database = await getDb()
  const doc: JobDocument = {
    status: 'pending',
    filename,
    pdfFileId: null,
    thinking: '',
    jsonOutput: null,
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
export async function listJobs(limit = 200): Promise<JobDocument[]> {
  const database = await getDb()
  return database
    .collection<JobDocument>('jobs')
    .find({}, { projection: { thinking: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
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
