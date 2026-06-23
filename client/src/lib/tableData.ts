export type TableCell = string | number | boolean | null
export interface TableSpec {
  title?: string
  columns: string[]
  rows: TableCell[][]
}

/** Coerce the loosely-typed Hermes table payload into a safe array of tables. */
export function normalizeTables(data: Record<string, unknown> | null): TableSpec[] {
  if (!data || typeof data !== 'object') return []
  const raw = (data as { tables?: unknown }).tables
  if (!Array.isArray(raw)) return []

  return raw
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
    .map(t => {
      const columns = Array.isArray(t.columns) ? t.columns.map(c => String(c ?? '')) : []
      const rows = Array.isArray(t.rows)
        ? t.rows.map(r => (Array.isArray(r) ? (r as TableCell[]) : [r as TableCell]))
        : []
      return {
        title: typeof t.title === 'string' ? t.title : undefined,
        columns,
        rows,
      }
    })
    .filter(t => t.columns.length > 0 || t.rows.length > 0)
}

export function cellToText(cell: TableCell): string {
  if (cell === null || cell === undefined) return ''
  if (typeof cell === 'object') return JSON.stringify(cell)
  return String(cell)
}

/** Render the normalized tables as GitHub-flavoured markdown (used for copy). */
export function tablesToMarkdown(tables: TableSpec[]): string {
  return tables
    .map(t => {
      const lines: string[] = []
      if (t.title) lines.push(`### ${t.title}`, '')
      if (t.columns.length > 0) {
        lines.push(`| ${t.columns.join(' | ')} |`)
        lines.push(`| ${t.columns.map(() => '---').join(' | ')} |`)
      }
      for (const row of t.rows) {
        const cells = t.columns.length > 0 ? t.columns.map((_, i) => row[i]) : row
        lines.push(`| ${cells.map(cellToText).join(' | ')} |`)
      }
      return lines.join('\n')
    })
    .join('\n\n')
}
