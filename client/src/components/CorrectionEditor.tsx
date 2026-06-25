import { useMemo, useState } from 'react'
import { Loader2, Check, X, CircleCheck, CircleAlert } from 'lucide-react'
import JsonCodeEditor from './JsonCodeEditor'
import TableEditor from './TableEditor'
import { tablesToJson, type TableSpec } from '../lib/tableData'

export type CorrectionMode = 'json' | 'tabular'

export interface CorrectionResult {
  mode: CorrectionMode
  correctedJson: Record<string, unknown>
  correctedTables?: TableSpec[]
}

interface CorrectionEditorProps {
  jobId: string
  mode: CorrectionMode
  initialJson: Record<string, unknown>
  initialTables: TableSpec[]
  onClose: () => void
  /** Called after a successful save with the corrected payload, so the parent
   * can show the before/after diff in the output views. */
  onSaved?: (result: CorrectionResult) => void
}

// Lets the user fix a job's extracted output and submit it as a correction. The
// edit surface follows the view the fix was invoked from — a VS Code–style JSON
// editor for the JSON tab, an editable grid for the Tabular tab. Either way the
// correction is stored + embedded server-side so similar future documents
// retrieve it as a few-shot example (the learning loop).
export default function CorrectionEditor({
  jobId,
  mode,
  initialJson,
  initialTables,
  onClose,
  onSaved,
}: CorrectionEditorProps) {
  const [text, setText] = useState(() => JSON.stringify(initialJson, null, 2))
  const [tables, setTables] = useState<TableSpec[]>(initialTables)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Live JSON validity (JSON mode only) for the inline status pill.
  const jsonValid = useMemo(() => {
    if (mode !== 'json') return true
    try {
      const parsed = JSON.parse(text)
      return !!parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    } catch {
      return false
    }
  }, [mode, text])

  const buildCorrectedOutput = (): Record<string, unknown> | null => {
    if (mode === 'tabular') return tablesToJson(tables)
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      setError('That is not valid JSON. Fix the syntax and try again.')
      return null
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setError('The correction must be a JSON object.')
      return null
    }
    return parsed as Record<string, unknown>
  }

  const handleSave = async () => {
    const correctedOutput = buildCorrectedOutput()
    if (!correctedOutput) return

    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/correct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correctedOutput, note: note.trim() || undefined }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Failed to save the correction.')
      }
      setSaved(true)
      onSaved?.({
        mode,
        correctedJson: correctedOutput,
        correctedTables: mode === 'tabular' ? tables : undefined,
      })
      setTimeout(onClose, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSaving(false)
    }
  }

  const busy = saving || saved

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>
          Suggest a fix
        </p>
        <p className="text-xs" style={{ color: 'var(--accent-200)' }}>
          {mode === 'tabular'
            ? 'Edit the cells below — I\u2019ll learn from your changes for similar documents.'
            : 'Edit the JSON below — I\u2019ll learn from it for similar documents.'}
        </p>

        {mode === 'json' && (
          <span
            className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              color: jsonValid ? '#16a34a' : '#ef4444',
              backgroundColor: jsonValid ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            }}
          >
            {jsonValid ? <CircleCheck className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />}
            {jsonValid ? 'Valid JSON' : 'Invalid JSON'}
          </span>
        )}
      </div>

      {mode === 'tabular' ? (
        <TableEditor tables={tables} onChange={setTables} disabled={busy} />
      ) : (
        <JsonCodeEditor value={text} onChange={setText} disabled={busy} />
      )}

      <label className="mt-3 flex flex-col gap-1">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-200)' }}>
          Note to Tidy <span style={{ color: 'var(--accent-200)' }}>(optional)</span>
        </span>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          disabled={busy}
          rows={3}
          placeholder="Tell me how to handle documents like this next time — e.g. &quot;Qty comes from the Units column, not the pack count&quot; or &quot;This vendor&apos;s SKU ends with the width letter.&quot;"
          className="min-h-[72px] resize-y rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none"
          style={{ borderColor: 'var(--bg-300)', backgroundColor: 'var(--bg-100)', color: 'var(--text-100)' }}
        />
      </label>

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
          disabled={busy || (mode === 'json' && !jsonValid)}
          className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold text-white transition-colors"
          style={{
            backgroundColor: saved ? '#22c55e' : 'var(--primary-100)',
            opacity: saving || (mode === 'json' && !jsonValid) ? 0.7 : 1,
          }}
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
