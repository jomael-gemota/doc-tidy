import { Loader2, TableProperties } from 'lucide-react'
import { cellToText, normalizeTables } from '../lib/tableData'

interface TableViewProps {
  table: Record<string, unknown> | null
  /** True while the job is still processing and the table isn't ready yet. */
  isProcessing: boolean
}

export default function TableView({ table, isProcessing }: TableViewProps) {
  const tables = normalizeTables(table)

  if (tables.length === 0) {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center p-5">
        <div className="flex flex-col items-center gap-3 text-center">
          {isProcessing ? (
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--primary-200)' }} />
          ) : (
            <TableProperties className="h-6 w-6" style={{ color: 'var(--accent-200)' }} />
          )}
          <p className="max-w-xs text-sm" style={{ color: 'var(--accent-200)' }}>
            {isProcessing
              ? 'Tidy is laying out your data as tables…'
              : 'No table view is available for this document.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-5">
      <div className="flex flex-col gap-6">
        {tables.map((t, ti) => (
          <div key={ti} className="flex flex-col gap-2">
            {t.title && (
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>
                {t.title}
              </h3>
            )}
            <div
              className="overflow-x-auto rounded-xl border"
              style={{ borderColor: 'var(--bg-300)', backgroundColor: '#fcfcfd' }}
            >
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
                    </tr>
                  </thead>
                )}
                <tbody>
                  {t.rows.map((row, ri) => (
                    <tr
                      key={ri}
                      style={{ backgroundColor: ri % 2 === 0 ? 'transparent' : 'var(--bg-100)' }}
                    >
                      {(t.columns.length > 0 ? t.columns.map((_, i) => row[i]) : row).map(
                        (cell, ci) => (
                          <td
                            key={ci}
                            className="px-3 py-2 align-top"
                            style={{
                              color: 'var(--text-200)',
                              borderBottom: '1px solid var(--bg-300)',
                            }}
                          >
                            {cellToText(cell)}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
