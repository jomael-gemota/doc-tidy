import { useCallback, useEffect, useState } from 'react'

export type BatchStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Batch {
  _id: string
  status: BatchStatus
  filename: string
  pdfFileId: string | null
  jsonOutput: Record<string, unknown> | null
  error: string | null
  createdAt: string
  completedAt: string | null
  // Vendor was unregistered when this doc was processed — needs SKU formats.
  vendorNeedsSetup?: boolean
  // Number of corrections recorded for this job (joined server-side).
  correctionCount?: number
}

interface UseBatchesResult {
  batches: Batch[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  deleteBatch: (id: string) => Promise<void>
  rerunBatch: (id: string) => Promise<void>
}

export function useBatches(): UseBatchesResult {
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs')
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = (await res.json()) as Batch[]
      setBatches(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load batches')
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteBatch = useCallback(async (id: string) => {
    const res = await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error ?? `Server error ${res.status}`)
    }
    // Optimistically remove from local state; follow up with a refresh.
    setBatches(prev => prev.filter(b => b._id !== id))
    await refresh()
  }, [refresh])

  const rerunBatch = useCallback(async (id: string) => {
    const res = await fetch(`/api/jobs/${id}/rerun`, { method: 'POST' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error ?? `Server error ${res.status}`)
    }
    // Update the batch status optimistically then sync.
    setBatches(prev =>
      prev.map(b =>
        b._id === id
          ? { ...b, status: 'pending', jsonOutput: null, error: null, completedAt: null }
          : b,
      ),
    )
    await refresh()
  }, [refresh])

  useEffect(() => {
    // Initial load from the server (an external system); state updates happen async.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
  }, [refresh])

  return { batches, loading, error, refresh, deleteBatch, rerunBatch }
}
