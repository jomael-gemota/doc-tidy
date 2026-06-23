import { useEffect, useRef, useState } from 'react'

export type StreamEventType = 'thinking' | 'output' | 'done' | 'error' | 'status'

export interface StreamEvent {
  type: StreamEventType
  content?: string
  json?: Record<string, unknown>
  table?: Record<string, unknown> | null
  status?: string
  message?: string
}

export interface JobStreamState {
  thinking: string
  output: string
  json: Record<string, unknown> | null
  table: Record<string, unknown> | null
  status: 'idle' | 'connecting' | 'processing' | 'completed' | 'failed'
  error: string | null
}

export function useJobStream(jobId: string | undefined): JobStreamState {
  const [state, setState] = useState<JobStreamState>({
    thinking: '',
    output: '',
    json: null,
    table: null,
    status: 'idle',
    error: null,
  })

  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!jobId) return

    // Reset before subscribing to the SSE stream (an external system) for this job.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ thinking: '', output: '', json: null, table: null, status: 'connecting', error: null })

    const es = new EventSource(`/api/stream/${jobId}`)
    esRef.current = es

    es.onopen = () => {
      setState(prev => ({ ...prev, status: 'processing' }))
    }

    es.addEventListener('thinking', (e: MessageEvent) => {
      const data: StreamEvent = JSON.parse(e.data)
      setState(prev => ({ ...prev, thinking: prev.thinking + (data.content ?? '') }))
    })

    es.addEventListener('output', (e: MessageEvent) => {
      const data: StreamEvent = JSON.parse(e.data)
      setState(prev => ({ ...prev, output: prev.output + (data.content ?? '') }))
    })

    es.addEventListener('done', (e: MessageEvent) => {
      const data: StreamEvent = JSON.parse(e.data)
      setState(prev => ({
        ...prev,
        json: data.json ?? null,
        table: data.table ?? null,
        status: 'completed',
      }))
      es.close()
    })

    es.addEventListener('status', (e: MessageEvent) => {
      const data: StreamEvent = JSON.parse(e.data)
      setState(prev => ({ ...prev, status: (data.status as JobStreamState['status']) ?? prev.status }))
    })

    es.onerror = () => {
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: 'Connection to server lost. Please refresh.',
      }))
      es.close()
    }

    return () => {
      es.close()
    }
  }, [jobId])

  return state
}
