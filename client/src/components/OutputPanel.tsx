import { useEffect, useMemo, useState } from 'react'
import { Code2, Copy, Check, Table2, FileSpreadsheet, PencilLine, GitCompareArrows, EyeOff } from 'lucide-react'
import JsonView from './JsonView'
import TableView from './TableView'
import CorrectionEditor, { type CorrectionMode, type CorrectionResult } from './CorrectionEditor'
import { normalizeTables, tablesToMarkdown, tablesToExcel, type TableSpec } from '../lib/tableData'
import { computeCorrectionView } from '../lib/correctionDiff'

// The latest saved correction for this job, in the shape needed to recompute the
// before/after diff. Sourced from the server on load (persistent) or from a fresh
// save in this session.
interface SavedCorrection {
  mode: CorrectionMode
  originalOutput: Record<string, unknown> | null
  correctedOutput: Record<string, unknown>
  correctedTables?: TableSpec[]
}

interface OutputPanelProps {
  rawOutput: string
  json: Record<string, unknown> | null
  table: Record<string, unknown> | null
  isActive: boolean
  isProcessing: boolean
  filename?: string
  jobId?: string
}

type TabId = 'json' | 'tabular'

export default function OutputPanel({
  rawOutput,
  json,
  table,
  isActive,
  isProcessing,
  filename,
  jobId,
}: OutputPanelProps) {
  const [tab, setTab] = useState<TabId>('tabular')
  const [copied, setCopied] = useState(false)
  // Null when not editing; otherwise the mode captured when the fix was invoked
  // so switching tabs can't change the edit surface mid-correction.
  const [correctionMode, setCorrectionMode] = useState<CorrectionMode | null>(null)
  // The latest saved correction (server-loaded or freshly saved). Drives the
  // persistent before/after diff shown in both views.
  const [savedCorrection, setSavedCorrection] = useState<SavedCorrection | null>(null)
  // Session-only collapse of the diff highlight; resets (shows again) on reload.
  const [diffHidden, setDiffHidden] = useState(false)

  const correcting = correctionMode !== null
  const jsonTarget = useMemo(
    () => json ?? (rawOutput.trim() ? safeParse(rawOutput) : null),
    [json, rawOutput],
  )
  const tableSpecs = useMemo(() => normalizeTables(table), [table])
  const canCopy = tab === 'json' ? !!jsonTarget : tableSpecs.length > 0
  const canDownload = tableSpecs.length > 0
  const canCorrect =
    !!jobId && !isProcessing && (tab === 'json' ? !!jsonTarget : tableSpecs.length > 0)

  const handleCopy = async () => {
    const text =
      tab === 'json'
        ? jsonTarget
          ? JSON.stringify(jsonTarget, null, 2)
          : rawOutput
        : tablesToMarkdown(tableSpecs)
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    tablesToExcel(tableSpecs, filename)
  }

  // Load any persisted correction for this job so the diff survives a refresh.
  useEffect(() => {
    if (!jobId) return
    let cancelled = false
    fetch(`/api/jobs/${jobId}/corrections`)
      .then(r => (r.ok ? r.json() : []))
      .then((list: unknown) => {
        if (cancelled) return
        const latest = Array.isArray(list) && list.length > 0 ? (list[0] as {
          mode?: string
          originalOutput?: Record<string, unknown> | null
          correctedOutput?: Record<string, unknown>
          correctedTables?: unknown
        }) : null
        if (!latest?.correctedOutput) {
          setSavedCorrection(null)
          return
        }
        setSavedCorrection({
          mode: latest.mode === 'tabular' ? 'tabular' : 'json',
          originalOutput: latest.originalOutput ?? null,
          correctedOutput: latest.correctedOutput,
          correctedTables: Array.isArray(latest.correctedTables)
            ? (latest.correctedTables as TableSpec[])
            : undefined,
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [jobId])

  const correction = useMemo(() => {
    if (!savedCorrection) return null
    return computeCorrectionView({
      mode: savedCorrection.mode,
      originalJson: savedCorrection.originalOutput ?? jsonTarget ?? {},
      correctedJson: savedCorrection.correctedOutput,
      originalTables: tableSpecs,
      correctedTables: savedCorrection.correctedTables,
    })
  }, [savedCorrection, jsonTarget, tableSpecs])

  const handleSaved = (result: CorrectionResult) => {
    setSavedCorrection({
      mode: result.mode,
      originalOutput: jsonTarget,
      correctedOutput: result.correctedJson,
      correctedTables: result.correctedTables,
    })
    setDiffHidden(false)
  }

  const startCorrection = () => {
    setCorrectionMode(tab)
  }

  const hasCorrection = !correcting && !!correction && correction.changeCount > 0
  const showingDiff = hasCorrection && !diffHidden

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: 'var(--bg-100)' }}>
      {/* Panel header — tab bar + contextual actions */}
      <div
        className="flex flex-shrink-0 items-center gap-3 px-5 py-3"
        style={{ borderBottom: '1px solid var(--bg-300)', backgroundColor: 'var(--bg-100)' }}
      >
        <div
          className="flex items-center gap-1 rounded-lg p-1"
          style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--bg-300)' }}
        >
          <TabButton
            id="tabular"
            label="Tabular"
            icon={Table2}
            active={tab === 'tabular'}
            disabled={correcting}
            onClick={() => setTab('tabular')}
          />
          <TabButton
            id="json"
            label="JSON"
            icon={Code2}
            active={tab === 'json'}
            disabled={correcting}
            onClick={() => setTab('json')}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {isActive && !json && tab === 'json' && (
            <span
              className="flex items-center gap-1.5 text-xs font-medium"
              style={{ color: 'var(--primary-200)' }}
            >
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full"
                style={{ backgroundColor: 'var(--primary-200)' }}
              />
              Writing…
            </span>
          )}

          {hasCorrection && (
            <button
              type="button"
              onClick={() => setDiffHidden(h => !h)}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
              style={{
                color: showingDiff ? 'var(--primary-200)' : 'var(--text-200)',
                borderColor: showingDiff ? 'rgba(255, 102, 0, 0.25)' : 'var(--bg-300)',
                backgroundColor: showingDiff ? 'rgba(255, 102, 0, 0.05)' : 'var(--bg-200)',
              }}
              title={showingDiff ? 'Hide the correction diff' : 'Show the correction diff'}
            >
              {showingDiff ? <EyeOff className="h-3.5 w-3.5" /> : <GitCompareArrows className="h-3.5 w-3.5" />}
              {showingDiff ? 'Hide changes' : 'Show changes'}
            </button>
          )}

          {canCorrect && !correcting && (
            <button
              type="button"
              onClick={startCorrection}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
              style={{
                color: 'var(--primary-200)',
                borderColor: 'rgba(255, 102, 0, 0.25)',
                backgroundColor: 'rgba(255, 102, 0, 0.05)',
              }}
            >
              <PencilLine className="h-3.5 w-3.5" />
              Suggest a fix
            </button>
          )}

          {canDownload && (
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
              style={{
                color: 'var(--text-200)',
                borderColor: 'var(--bg-300)',
                backgroundColor: 'var(--bg-200)',
              }}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" style={{ color: '#16a34a' }} />
              Download .xlsx
            </button>
          )}

          {canCopy && (
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
        </div>
      </div>

      {/* Saved-correction banner — explains the inline before/after diff below */}
      {showingDiff && (
        <div
          className="flex flex-shrink-0 items-center gap-2 px-5 py-2.5"
          style={{
            borderBottom: '1px solid var(--bg-300)',
            backgroundColor: 'rgba(255, 102, 0, 0.05)',
          }}
        >
          <GitCompareArrows className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--primary-200)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--text-200)' }}>
            Showing your saved correction —{' '}
            <span className="font-semibold" style={{ color: 'var(--text-100)' }}>
              {correction!.changeCount} {correction!.changeCount === 1 ? 'change' : 'changes'}
            </span>
            . Original values are{' '}
            <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>struck through</span>; new
            values are <span className="font-semibold" style={{ color: 'var(--text-100)' }}>bold</span>.
          </span>
          <button
            type="button"
            onClick={() => setDiffHidden(true)}
            className="ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors"
            style={{ color: 'var(--text-200)', borderColor: 'var(--bg-300)', backgroundColor: 'var(--bg-100)' }}
          >
            <EyeOff className="h-3 w-3" />
            Hide
          </button>
        </div>
      )}

      {/* Active tab body — or the correction editor when suggesting a fix */}
      {correcting ? (
        <CorrectionEditor
          jobId={jobId!}
          mode={correctionMode}
          initialJson={jsonTarget ?? {}}
          initialTables={tableSpecs}
          onClose={() => setCorrectionMode(null)}
          onSaved={handleSaved}
        />
      ) : tab === 'json' ? (
        <JsonView
          rawOutput={rawOutput}
          json={json}
          isActive={isActive}
          diff={showingDiff ? correction!.jsonDiff : null}
        />
      ) : (
        <TableView
          table={table}
          isProcessing={isProcessing}
          diff={showingDiff ? correction!.tableDiff : null}
        />
      )}
    </div>
  )
}

function safeParse(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

interface TabButtonProps {
  id: TabId
  label: string
  icon: typeof Code2
  active: boolean
  disabled?: boolean
  onClick: () => void
}

function TabButton({ label, icon: Icon, active, disabled, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
      style={{
        color: active ? 'var(--primary-200)' : 'var(--accent-200)',
        backgroundColor: active ? 'var(--bg-100)' : 'transparent',
        boxShadow: active ? '0 1px 2px rgba(17, 24, 39, 0.08)' : 'none',
        opacity: disabled && !active ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
