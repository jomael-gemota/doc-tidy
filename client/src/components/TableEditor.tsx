import { Plus, Trash2 } from 'lucide-react'
import type { TableSpec } from '../lib/tableData'
import { cellToText } from '../lib/tableData'

interface TableEditorProps {
  tables: TableSpec[]
  onChange: (next: TableSpec[]) => void
  disabled?: boolean
}

// Editable grid used when the user invokes "Suggest a fix" from the Tabular view.
// Edits update the in-memory TableSpec[]; CorrectionEditor reconstructs JSON from
// it on save (see design-log/2026-06-26-mode-aware-correction-editor.md).
export default function TableEditor({ tables, onChange, disabled }: TableEditorProps) {
  const updateTable = (ti: number, next: TableSpec) => {
    onChange(tables.map((t, i) => (i === ti ? next : t)))
  }

  const setCell = (ti: number, ri: number, ci: number, value: string) => {
    const t = tables[ti]
    const rows = t.rows.map((row, r) => {
      if (r !== ri) return row
      const copy = [...row]
      copy[ci] = value
      return copy
    })
    updateTable(ti, { ...t, rows })
  }

  const addRow = (ti: number) => {
    const t = tables[ti]
    const width = t.columns.length > 0 ? t.columns.length : t.rows[0]?.length ?? 1
    updateTable(ti, { ...t, rows: [...t.rows, Array.from({ length: width }, () => '')] })
  }

  const removeRow = (ti: number, ri: number) => {
    const t = tables[ti]
    updateTable(ti, { ...t, rows: t.rows.filter((_, r) => r !== ri) })
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-lg border p-4" style={{ borderColor: 'var(--bg-300)', backgroundColor: '#fcfcfd' }}>
      <div className="flex flex-col gap-6">
        {tables.map((t, ti) => {
          const colCount = t.columns.length > 0 ? t.columns.length : t.rows[0]?.length ?? 1
          const colIndices = Array.from({ length: colCount }, (_, i) => i)
          return (
            <div key={ti} className="flex flex-col gap-2">
              {t.title && (
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>
                  {t.title}
                </h3>
              )}
              <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--bg-300)' }}>
                <table className="w-full border-collapse text-left text-sm">
                  {t.columns.length > 0 && (
                    <thead>
                      <tr>
                        {t.columns.map((col, ci) => (
                          <th
                            key={ci}
                            className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide"
                            style={{
                              color: 'var(--accent-200)',
                              backgroundColor: 'var(--bg-200)',
                              borderBottom: '1px solid var(--bg-300)',
                            }}
                          >
                            {col}
                          </th>
                        ))}
                        <th
                          className="w-10 px-2 py-2.5"
                          style={{ backgroundColor: 'var(--bg-200)', borderBottom: '1px solid var(--bg-300)' }}
                        />
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {t.rows.map((row, ri) => (
                      <tr key={ri} style={{ backgroundColor: ri % 2 === 0 ? 'transparent' : 'var(--bg-100)' }}>
                        {colIndices.map(ci => (
                          <td
                            key={ci}
                            className="align-top"
                            style={{ borderBottom: '1px solid var(--bg-300)' }}
                          >
                            <input
                              type="text"
                              value={cellToText(row[ci] ?? '')}
                              onChange={e => setCell(ti, ri, ci, e.target.value)}
                              disabled={disabled}
                              className="w-full bg-transparent px-3 py-2 text-sm outline-none focus:bg-[rgba(255,102,0,0.04)]"
                              style={{ color: 'var(--text-200)', minWidth: 80 }}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-1 text-center align-middle" style={{ borderBottom: '1px solid var(--bg-300)' }}>
                          <button
                            type="button"
                            onClick={() => removeRow(ti, ri)}
                            disabled={disabled}
                            title="Remove row"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-[rgba(239,68,68,0.1)]"
                            style={{ color: 'var(--accent-200)' }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={() => addRow(ti)}
                disabled={disabled}
                className="inline-flex w-fit items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
                style={{ color: 'var(--text-200)', borderColor: 'var(--bg-300)', backgroundColor: 'var(--bg-200)' }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add row
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
