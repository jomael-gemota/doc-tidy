import { useEffect, useState } from 'react'

export interface HealthState {
  reachable: boolean
  workerConnected: boolean
}

// Polls /api/health so the navbar can surface whether the processing worker is online.
export function useHealth(intervalMs = 10000): HealthState {
  const [state, setState] = useState<HealthState>({ reachable: false, workerConnected: false })

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch('/api/health')
        const data = (await res.json()) as { ok?: boolean; workerConnected?: boolean }
        if (!cancelled) {
          setState({ reachable: Boolean(data.ok), workerConnected: Boolean(data.workerConnected) })
        }
      } catch {
        if (!cancelled) setState({ reachable: false, workerConnected: false })
      }
    }

    poll()
    const id = setInterval(poll, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [intervalMs])

  return state
}
