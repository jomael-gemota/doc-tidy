import { useEffect, useState } from 'react'
import { Code2, Copy, Check, X } from 'lucide-react'
import { renderJsonValue, type JsonValue } from '../lib/jsonHighlight'
import type { Batch } from '../hooks/useBatches'

interface JsonModalProps {
  batch: Batch
  onClose: () => void
}

export default function JsonModal({ batch, onClose }: JsonModalProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const json = (batch.jsonOutput as JsonValue | null) ?? null
  const text = json ? JSON.stringify(json, null, 2) : ''

  const handleCopy = async () => {
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(17, 24, 39, 0.45)' }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border shadow-xl"
        style={{ borderColor: 'var(--bg-300)', backgroundColor: 'var(--bg-100)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2.5 px-5 py-3.5"
          style={{ borderBottom: '1px solid var(--bg-300)' }}
        >
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: 'rgba(255, 152, 63, 0.12)' }}
          >
            <Code2 className="h-4 w-4" style={{ color: 'var(--primary-200)' }} />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>
              JSON Output
            </span>
            <p className="truncate text-xs leading-none" style={{ color: 'var(--accent-200)' }}>
              {batch.filename}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {json && (
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
                style={{
                  color: copied ? '#22c55e' : 'var(--text-200)',
                  borderColor: copied ? 'rgba(34, 197, 94, 0.35)' : 'var(--bg-300)',
                  backgroundColor: copied ? 'rgba(34, 197, 94, 0.05)' : 'var(--bg-200)',
                }}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" style={{ color: '#22c55e' }} />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5"
              style={{ color: 'var(--accent-200)' }}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {json ? (
            <div
              className="overflow-x-auto rounded-xl border p-4"
              style={{ borderColor: 'var(--bg-300)', backgroundColor: '#fcfcfd' }}
            >
              <pre
                className="font-mono text-[13px] leading-6 whitespace-pre-wrap break-words"
                style={{ margin: 0, color: 'var(--text-200)' }}
              >
                {renderJsonValue(json)}
              </pre>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <p className="text-sm" style={{ color: 'var(--accent-200)' }}>
                {batch.status === 'failed'
                  ? batch.error ?? 'This batch failed before producing output.'
                  : 'No JSON output yet — this batch is still being processed.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
