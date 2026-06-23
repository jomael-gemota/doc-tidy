import { useState } from 'react'
import { Code2, Copy, Check, Table2 } from 'lucide-react'
import JsonView from './JsonView'
import TableView from './TableView'
import { normalizeTables, tablesToMarkdown } from '../lib/tableData'

interface OutputPanelProps {
  rawOutput: string
  json: Record<string, unknown> | null
  table: Record<string, unknown> | null
  isActive: boolean
  isProcessing: boolean
}

type TabId = 'json' | 'tabular'

export default function OutputPanel({
  rawOutput,
  json,
  table,
  isActive,
  isProcessing,
}: OutputPanelProps) {
  const [tab, setTab] = useState<TabId>('json')
  const [copied, setCopied] = useState(false)

  const jsonTarget = json ?? (rawOutput.trim() ? safeParse(rawOutput) : null)
  const tableSpecs = normalizeTables(table)
  const canCopy = tab === 'json' ? !!jsonTarget : tableSpecs.length > 0

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
            id="json"
            label="JSON"
            icon={Code2}
            active={tab === 'json'}
            onClick={() => setTab('json')}
          />
          <TabButton
            id="tabular"
            label="Tabular"
            icon={Table2}
            active={tab === 'tabular'}
            onClick={() => setTab('tabular')}
          />
        </div>

        {isActive && !json && tab === 'json' && (
          <span
            className="ml-auto flex items-center gap-1.5 text-xs font-medium"
            style={{ color: 'var(--primary-200)' }}
          >
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full"
              style={{ backgroundColor: 'var(--primary-200)' }}
            />
            Writing…
          </span>
        )}

        {canCopy && (
          <button
            type="button"
            onClick={handleCopy}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
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

      {/* Active tab body */}
      {tab === 'json' ? (
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
  onClick: () => void
}

function TabButton({ label, icon: Icon, active, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
      style={{
        color: active ? 'var(--primary-200)' : 'var(--accent-200)',
        backgroundColor: active ? 'var(--bg-100)' : 'transparent',
        boxShadow: active ? '0 1px 2px rgba(17, 24, 39, 0.08)' : 'none',
      }}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
