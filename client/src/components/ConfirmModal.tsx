import { useEffect, type ReactNode } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'

interface ConfirmModalProps {
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}

// Destructive-action confirmation dialog. Follows the JsonModal overlay pattern
// (fixed inset-0, click-outside to close, Escape to cancel). The confirm button
// is styled red to signal an irreversible action.
export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  busy = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, busy])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(17, 24, 39, 0.45)' }}
      onClick={() => {
        if (!busy) onCancel()
      }}
    >
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border shadow-xl"
        style={{ borderColor: 'var(--bg-300)', backgroundColor: 'var(--bg-100)' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center gap-2.5 px-5 py-3.5"
          style={{ borderBottom: '1px solid var(--bg-300)' }}
        >
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)' }}
          >
            <AlertTriangle className="h-4 w-4" style={{ color: '#ef4444' }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>
            {title}
          </span>
          <button
            type="button"
            onClick={() => {
              if (!busy) onCancel()
            }}
            className="ml-auto rounded-lg p-1.5"
            style={{ color: 'var(--accent-200)' }}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="text-sm leading-relaxed" style={{ color: 'var(--text-200)' }}>
            {message}
          </div>
          {error && (
            <p className="mt-3 text-xs font-medium" style={{ color: '#ef4444' }}>
              {error}
            </p>
          )}
        </div>

        <div
          className="flex items-center justify-end gap-2 px-5 py-3.5"
          style={{ borderTop: '1px solid var(--bg-300)' }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border px-3.5 py-2 text-sm font-medium transition-colors"
            style={{
              color: 'var(--text-200)',
              borderColor: 'var(--bg-300)',
              backgroundColor: 'var(--bg-200)',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: '#ef4444', opacity: busy ? 0.7 : 1 }}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
