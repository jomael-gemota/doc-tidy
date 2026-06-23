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
}

interface UseBatchesResult {
  batches: Batch[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
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

  useEffect(() => {
    // Initial load from the server (an external system); state updates happen async.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
  }, [refresh])

  return { batches, loading, error, refresh }
}
