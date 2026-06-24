import { useState } from 'react'
import { Loader2, Check, X } from 'lucide-react'

interface CorrectionEditorProps {
  jobId: string
  initialJson: Record<string, unknown>
  onClose: () => void
}

// Lets the user fix a job's extracted JSON and submit it as a correction. The
// correction is stored + embedded server-side so similar future documents
// retrieve it as a few-shot example (the learning loop).
export default function CorrectionEditor({ jobId, initialJson, onClose }: CorrectionEditorProps) {
  const [text, setText] = useState(() => JSON.stringify(initialJson, null, 2))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      setError('That is not valid JSON. Fix the syntax and try again.')
      return
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setError('The correction must be a JSON object.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/correct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correctedOutput: parsed, note: note.trim() || undefined }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Failed to save the correction.')
      }
      setSaved(true)
      setTimeout(onClose, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col p-4">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>
          Suggest a fix
        </p>
        <p className="text-xs" style={{ color: 'var(--accent-200)' }}>
          Edit the JSON below — I&apos;ll learn from it for similar documents.
        </p>
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        disabled={saving || saved}
        spellCheck={false}
        className="min-h-0 flex-1 resize-none rounded-lg border p-3 font-mono text-xs leading-relaxed outline-none"
        style={{ borderColor: 'var(--bg-300)', backgroundColor: 'var(--bg-100)', color: 'var(--text-100)' }}
      />

      <input
        type="text"
        value={note}
        onChange={e => setNote(e.target.value)}
        disabled={saving || saved}
        placeholder="Optional note — e.g. 'Qty should come from the Units column, not the pack count.'"
        className="mt-2 rounded-md border px-2.5 py-1.5 text-xs outline-none"
        style={{ borderColor: 'var(--bg-300)', backgroundColor: 'var(--bg-100)', color: 'var(--text-100)' }}
      />

      {error && (
        <p className="mt-2 text-xs font-medium" style={{ color: '#ef4444' }}>
          {error}
        </p>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
          style={{ color: 'var(--text-200)', borderColor: 'var(--bg-300)', backgroundColor: 'var(--bg-200)' }}
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || saved}
          className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold text-white transition-colors"
          style={{ backgroundColor: saved ? '#22c55e' : 'var(--primary-100)', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saved ? (
            <Check className="h-3.5 w-3.5" />
          ) : null}
          {saved ? 'Saved — thanks!' : saving ? 'Saving…' : 'Save correction'}
        </button>
      </div>
    </div>
  )
}
