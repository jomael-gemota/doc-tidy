import type { WebSocket } from 'ws'
import type { Response } from 'express'

type SseClient = Response

interface SseEvent {
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

class WorkerRegistry {
  private workerSocket: WebSocket | null = null
  private sseClients = new Map<string, Set<SseClient>>()

  setWorker(ws: WebSocket): void {
    this.workerSocket = ws
    console.log('[registry] worker connected')

    ws.on('close', () => {
      if (this.workerSocket === ws) {
        this.workerSocket = null
        console.log('[registry] worker disconnected')
      }
    })
  }

  hasWorker(): boolean {
    return this.workerSocket !== null && this.workerSocket.readyState === 1
  }

  sendToWorker(message: object): boolean {
    if (!this.hasWorker()) return false
    this.workerSocket!.send(JSON.stringify(message))
    return true
  }

  addSseClient(jobId: string, res: SseClient): void {
    if (!this.sseClients.has(jobId)) {
      this.sseClients.set(jobId, new Set())
    }
    this.sseClients.get(jobId)!.add(res)
    console.log(`[registry] SSE client added for job ${jobId}`)
  }

  removeSseClient(jobId: string, res: SseClient): void {
    this.sseClients.get(jobId)?.delete(res)
    if (this.sseClients.get(jobId)?.size === 0) {
      this.sseClients.delete(jobId)
    }
  }

  pushToJob(jobId: string, event: SseEvent): void {
    const clients = this.sseClients.get(jobId)
    if (!clients || clients.size === 0) return

    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
    for (const client of clients) {
      try {
        client.write(payload)
      } catch {
        clients.delete(client)
      }
    }
  }
}

export const registry = new WorkerRegistry()
