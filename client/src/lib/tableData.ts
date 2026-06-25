import * as XLSX from 'xlsx'

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

/** A Hermes ["Field", "Value"] summary table holds scalar key/value pairs. */
function isFieldValueTable(t: TableSpec): boolean {
  return (
    t.columns.length === 2 &&
    t.columns[0].toLowerCase() === 'field' &&
    t.columns[1].toLowerCase() === 'value'
  )
}

/** Coerce a user-edited cell string back into a JSON scalar (number/bool/null). */
export function coerceCell(cell: TableCell): TableCell {
  if (typeof cell !== 'string') return cell
  const trimmed = cell.trim()
  if (trimmed === '') return ''
  if (trimmed === 'null') return null
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  // Only treat as a number when the whole string is a clean numeric literal,
  // so identifiers like "007" or "1/2" stay strings.
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed) && String(Number(trimmed)) === trimmed) {
    return Number(trimmed)
  }
  return cell
}

/** camelCase a human title into a JSON key: "Line Items" → "lineItems". */
function toKey(label: string): string {
  const words = label
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return ''
  return words
    .map((w, i) =>
      i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join('')
}

/**
 * Reconstruct a JSON object from edited tables, to submit as a correction's
 * `correctedOutput` when the user fixed values in the Tabular view.
 *
 *   - Field/Value tables  → top-level key/value pairs
 *   - multi-column tables → array of row objects under a camelCased title key
 *   - single-column lists → array of values under a camelCased title/column key
 */
export function tablesToJson(tables: TableSpec[]): Record<string, unknown> {
  const root: Record<string, unknown> = {}
  const used = new Set<string>()

  const uniqueKey = (base: string): string => {
    const safe = base || 'items'
    let name = safe
    let counter = 2
    while (used.has(name)) name = `${safe}${counter++}`
    used.add(name)
    return name
  }

  tables.forEach((t, idx) => {
    if (isFieldValueTable(t)) {
      for (const row of t.rows) {
        const k = cellToText(row[0]).trim()
        if (k) root[k] = coerceCell(row[1] ?? null)
      }
      return
    }

    if (t.columns.length > 1) {
      const key = uniqueKey(toKey(t.title ?? '') || `table${idx + 1}`)
      root[key] = t.rows.map(row => {
        const obj: Record<string, TableCell> = {}
        t.columns.forEach((col, i) => {
          obj[col] = coerceCell(row[i] ?? null)
        })
        return obj
      })
      return
    }

    const key = uniqueKey(toKey(t.title ?? t.columns[0] ?? '') || 'values')
    root[key] = t.rows.map(row => coerceCell(row[0] ?? null))
  })

  return root
}

/** Build a worksheet with field names on row 1 and values from row 2 onward. */
function sheetFromAoa(aoa: TableCell[][]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const colWidths: number[] = []
  for (const row of aoa) {
    row.forEach((cell, ci) => {
      const len = cellToText(cell).length
      colWidths[ci] = Math.min(Math.max(colWidths[ci] ?? 8, len + 2), 50)
    })
  }
  ws['!cols'] = colWidths.map(w => ({ wch: w }))
  return ws
}

/** Append a sheet with a unique, Excel-safe (<=31 char) name. */
function appendUniqueSheet(
  wb: XLSX.WorkBook,
  ws: XLSX.WorkSheet,
  desiredName: string,
  used: Set<string>,
): void {
  const base = (desiredName || 'Sheet').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31)
  let name = base
  let counter = 2
  while (used.has(name)) {
    const suffix = ` (${counter++})`
    name = base.slice(0, 31 - suffix.length) + suffix
  }
  used.add(name)
  XLSX.utils.book_append_sheet(wb, ws, name)
}

/** A single labelled column destined for the Summary sheet. */
interface SummaryColumn {
  header: TableCell
  values: TableCell[]
}

/** Lay out summary columns side by side: headers on row 1, values from row 2 down. */
function aoaFromColumns(columns: SummaryColumn[]): TableCell[][] {
  const aoa: TableCell[][] = [columns.map(c => c.header)]
  const maxRows = columns.reduce((m, c) => Math.max(m, c.values.length), 0)
  for (let i = 0; i < maxRows; i++) {
    aoa.push(columns.map(c => c.values[i] ?? null))
  }
  return aoa
}

/**
 * Generate and trigger download of a two-sheet .xlsx file.
 *
 * Layout, with field ids as headers in row 1 and values from row 2 down:
 *   - "Summary" sheet — scalar ["Field", "Value"] tables plus single-column
 *     lists (e.g. Tracking Numbers). Each field/list becomes a column: its name
 *     is the header in row 1 and its value(s) stack beneath it.
 *   - One sheet per genuine multi-column table (e.g. "Line Items"): its columns
 *     are the headers in row 1, with one value row per item below.
 */
export function tablesToExcel(tables: TableSpec[], filename = 'results'): void {
  const wb = XLSX.utils.book_new()
  const used = new Set<string>()

  // Multi-column, non-field/value tables (e.g. Line Items) get their own sheet.
  // Everything else — scalar field/value tables and single-column lists — is
  // merged into the Summary sheet as labelled columns.
  const isOwnSheet = (t: TableSpec) => !isFieldValueTable(t) && t.columns.length > 1

  const summaryColumns: SummaryColumn[] = []
  for (const t of tables) {
    if (isOwnSheet(t)) continue
    if (isFieldValueTable(t)) {
      for (const row of t.rows) {
        summaryColumns.push({ header: row[0] ?? null, values: [row[1] ?? null] })
      }
    } else {
      // Single-column list: header is the column name (fallback to title).
      const header = t.columns[0] || t.title || 'Value'
      summaryColumns.push({ header, values: t.rows.map(row => row[0] ?? null) })
    }
  }

  if (summaryColumns.length > 0) {
    appendUniqueSheet(wb, sheetFromAoa(aoaFromColumns(summaryColumns)), 'Summary', used)
  }

  tables.filter(isOwnSheet).forEach((t, idx) => {
    const aoa: TableCell[][] = [t.columns]
    for (const row of t.rows) {
      aoa.push(t.columns.map((_, i) => row[i] ?? null))
    }
    appendUniqueSheet(wb, sheetFromAoa(aoa), t.title ?? `Table ${idx + 1}`, used)
  })

  if (wb.SheetNames.length === 0) {
    appendUniqueSheet(wb, sheetFromAoa([]), 'Results', used)
  }

  const safeFilename = filename.replace(/\.pdf$/i, '').replace(/[^\w\s-]/g, '') || 'results'
  XLSX.writeFile(wb, `${safeFilename}-results.xlsx`)
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
