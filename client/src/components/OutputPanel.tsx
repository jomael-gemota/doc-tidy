import { useState } from 'react'
import { Code2, Copy, Check, Table2, FileSpreadsheet, PencilLine } from 'lucide-react'
import JsonView from './JsonView'
import TableView from './TableView'
import CorrectionEditor, { type CorrectionMode } from './CorrectionEditor'
import { normalizeTables, tablesToMarkdown, tablesToExcel } from '../lib/tableData'

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

  const correcting = correctionMode !== null
  const jsonTarget = json ?? (rawOutput.trim() ? safeParse(rawOutput) : null)
  const tableSpecs = normalizeTables(table)
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

          {canCorrect && !correcting && (
            <button
              type="button"
              onClick={() => setCorrectionMode(tab)}
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

      {/* Active tab body — or the correction editor when suggesting a fix */}
      {correcting ? (
        <CorrectionEditor
          jobId={jobId!}
          mode={correctionMode}
          initialJson={jsonTarget ?? {}}
          initialTables={tableSpecs}
          onClose={() => setCorrectionMode(null)}
        />
      ) : tab === 'json' ? (
        <JsonView rawOutput={rawOutput} json={json} isActive={isActive} />
      ) : (
        <TableView table={table} isProcessing={isProcessing} />
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
