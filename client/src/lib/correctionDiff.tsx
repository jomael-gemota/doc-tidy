import { Fragment } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { renderJsonValue, tokenColors, type JsonValue } from './jsonHighlight'
import { cellToText, coerceCell, type TableSpec } from './tableData'

// Shared model + renderers for displaying a saved correction as a before/after
// diff. See design-log/2026-06-26-correction-diff-display.md. The JSON view
// renders a recursive DiffNode; the Tabular view renders TableDiffSpec[]. Both
// decorate changed values the same way: original struck through, new in bold.

export type DiffStatus = 'unchanged' | 'changed' | 'added' | 'removed'

export type DiffNode =
  | { kind: 'leaf'; status: 'unchanged'; value: JsonValue }
  | { kind: 'leaf'; status: 'changed'; before: JsonValue; after: JsonValue }
  | { kind: 'leaf'; status: 'added'; after: JsonValue }
  | { kind: 'leaf'; status: 'removed'; before: JsonValue }
  | { kind: 'object'; status: DiffStatus; entries: { key: string; node: DiffNode }[] }
  | { kind: 'array'; status: DiffStatus; items: DiffNode[] }

export interface CellDiff {
  status: DiffStatus
  before?: string
  after?: string
  text?: string
}
export interface RowDiff {
  status: DiffStatus
  cells: CellDiff[]
}
export interface TableDiffSpec {
  title?: string
  columns: string[]
  rows: RowDiff[]
}

export interface CorrectionView {
  jsonDiff: DiffNode
  tableDiff: TableDiffSpec[]
  changeCount: number
}

// ---------------------------------------------------------------------------
// JSON diff
// ---------------------------------------------------------------------------

const isObj = (v: unknown): v is Record<string, JsonValue> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

const deepEqual = (a: JsonValue, b: JsonValue) => JSON.stringify(a) === JSON.stringify(b)

/** Render a scalar JSON value the same way a table cell would, so value-match
 * projection lines up across the two views ("Justin" === cell text "Justin"). */
export function scalarText(v: JsonValue): string {
  if (v === null) return 'null'
  if (typeof v === 'string') return v
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

const addedLeaf = (after: JsonValue): DiffNode => ({ kind: 'leaf', status: 'added', after })
const removedLeaf = (before: JsonValue): DiffNode => ({ kind: 'leaf', status: 'removed', before })

const containerStatus = (children: DiffNode[]): DiffStatus =>
  children.some(c => c.status !== 'unchanged') ? 'changed' : 'unchanged'

/** Exact recursive diff between two JSON values (used for JSON-mode edits). */
export function diffJson(before: JsonValue, after: JsonValue): DiffNode {
  if (isObj(before) && isObj(after)) {
    const keys = Object.keys(before)
    for (const k of Object.keys(after)) if (!(k in before)) keys.push(k)
    const entries = keys.map(key => {
      const hasB = key in before
      const hasA = key in after
      const node = hasB && hasA
        ? diffJson(before[key], after[key])
        : hasA
          ? addedLeaf(after[key])
          : removedLeaf(before[key])
      return { key, node }
    })
    return { kind: 'object', status: containerStatus(entries.map(e => e.node)), entries }
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const len = Math.max(before.length, after.length)
    const items: DiffNode[] = []
    for (let i = 0; i < len; i++) {
      const hasB = i < before.length
      const hasA = i < after.length
      items.push(
        hasB && hasA
          ? diffJson(before[i], after[i])
          : hasA
            ? addedLeaf(after[i])
            : removedLeaf(before[i]),
      )
    }
    return { kind: 'array', status: containerStatus(items), items }
  }

  if (deepEqual(before, after)) return { kind: 'leaf', status: 'unchanged', value: after }
  return { kind: 'leaf', status: 'changed', before, after }
}

/** Mark leaves of `original` whose scalar text matches a recorded change
 * (used to project a tabular-mode edit onto the JSON view). */
export function diffJsonByValueMatches(
  original: JsonValue,
  matches: Map<string, JsonValue>,
): DiffNode {
  if (isObj(original)) {
    const entries = Object.keys(original).map(key => ({
      key,
      node: diffJsonByValueMatches(original[key], matches),
    }))
    return { kind: 'object', status: containerStatus(entries.map(e => e.node)), entries }
  }
  if (Array.isArray(original)) {
    const items = original.map(v => diffJsonByValueMatches(v, matches))
    return { kind: 'array', status: containerStatus(items), items }
  }
  const text = scalarText(original)
  if (text.trim() !== '' && matches.has(text)) {
    const after = matches.get(text) as JsonValue
    if (scalarText(after) !== text) return { kind: 'leaf', status: 'changed', before: original, after }
  }
  return { kind: 'leaf', status: 'unchanged', value: original }
}

interface ScalarChange {
  before: JsonValue
  after: JsonValue
}

function collectScalarChanges(node: DiffNode, out: ScalarChange[] = []): ScalarChange[] {
  if (node.kind === 'object') node.entries.forEach(e => collectScalarChanges(e.node, out))
  else if (node.kind === 'array') node.items.forEach(i => collectScalarChanges(i, out))
  else if (node.status === 'changed') out.push({ before: node.before, after: node.after })
  return out
}

function countNodeChanges(node: DiffNode): number {
  if (node.kind === 'object') return node.entries.reduce((s, e) => s + countNodeChanges(e.node), 0)
  if (node.kind === 'array') return node.items.reduce((s, i) => s + countNodeChanges(i), 0)
  return node.status === 'unchanged' ? 0 : 1
}

// ---------------------------------------------------------------------------
// Table diff
// ---------------------------------------------------------------------------

const colWidth = (t: TableSpec): number =>
  t.columns.length > 0 ? t.columns.length : t.rows.reduce((m, r) => Math.max(m, r.length), 0)

function diffOneTable(before: TableSpec, after: TableSpec): TableDiffSpec {
  const columns = after.columns.length > 0 ? after.columns : before.columns
  const width = Math.max(colWidth(before), colWidth(after), columns.length, 1)
  const rowCount = Math.max(before.rows.length, after.rows.length)
  const rows: RowDiff[] = []

  for (let ri = 0; ri < rowCount; ri++) {
    const br = before.rows[ri]
    const ar = after.rows[ri]
    if (br && ar) {
      const cells: CellDiff[] = []
      for (let ci = 0; ci < width; ci++) {
        const bt = cellToText(br[ci] ?? '')
        const at = cellToText(ar[ci] ?? '')
        cells.push(bt === at ? { status: 'unchanged', text: at } : { status: 'changed', before: bt, after: at })
      }
      rows.push({ status: containerStatusCells(cells), cells })
    } else if (ar) {
      const cells: CellDiff[] = Array.from({ length: width }, (_, ci) => ({
        status: 'added' as const,
        after: cellToText(ar[ci] ?? ''),
      }))
      rows.push({ status: 'added', cells })
    } else if (br) {
      const cells: CellDiff[] = Array.from({ length: width }, (_, ci) => ({
        status: 'removed' as const,
        before: cellToText(br[ci] ?? ''),
      }))
      rows.push({ status: 'removed', cells })
    }
  }

  return { title: after.title ?? before.title, columns, rows }
}

const containerStatusCells = (cells: CellDiff[]): DiffStatus =>
  cells.some(c => c.status !== 'unchanged') ? 'changed' : 'unchanged'

/** Exact index-aligned diff between two sets of tables (used for tabular edits). */
export function buildTableDiff(before: TableSpec[], after: TableSpec[]): TableDiffSpec[] {
  const count = Math.max(before.length, after.length)
  const result: TableDiffSpec[] = []
  for (let ti = 0; ti < count; ti++) {
    const b = before[ti]
    const a = after[ti]
    if (b && a) result.push(diffOneTable(b, a))
    else if (a) result.push(diffOneTable({ title: a.title, columns: a.columns, rows: [] }, a))
    else if (b) result.push(diffOneTable(b, { title: b.title, columns: b.columns, rows: [] }))
  }
  return result
}

/** Decorate cells of `tables` whose text matches a recorded change (used to
 * project a JSON-mode edit onto the Table view). */
export function buildTableDiffFromValueMatches(
  tables: TableSpec[],
  matches: Map<string, string>,
): TableDiffSpec[] {
  return tables.map(t => {
    const width = Math.max(colWidth(t), t.columns.length, 1)
    const rows: RowDiff[] = t.rows.map(row => {
      const w = Math.max(width, row.length)
      const cells: CellDiff[] = []
      for (let ci = 0; ci < w; ci++) {
        const text = cellToText(row[ci] ?? '')
        if (text.trim() !== '' && matches.has(text) && matches.get(text) !== text) {
          cells.push({ status: 'changed', before: text, after: matches.get(text) })
        } else {
          cells.push({ status: 'unchanged', text })
        }
      }
      return { status: containerStatusCells(cells), cells }
    })
    return { title: t.title, columns: t.columns, rows }
  })
}

function collectCellChanges(diffs: TableDiffSpec[]): { before: string; after: string }[] {
  const out: { before: string; after: string }[] = []
  for (const t of diffs)
    for (const r of t.rows)
      for (const c of r.cells)
        if (c.status === 'changed' && c.before !== undefined && c.after !== undefined)
          out.push({ before: c.before, after: c.after })
  return out
}

function countTableChanges(diffs: TableDiffSpec[]): number {
  let n = 0
  for (const t of diffs)
    for (const r of t.rows) {
      if (r.status === 'added' || r.status === 'removed') {
        n++
        continue
      }
      for (const c of r.cells) if (c.status !== 'unchanged') n++
    }
  return n
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function computeCorrectionView(input: {
  mode: 'json' | 'tabular'
  originalJson: Record<string, unknown>
  correctedJson: Record<string, unknown>
  originalTables: TableSpec[]
  correctedTables?: TableSpec[]
}): CorrectionView {
  if (input.mode === 'json') {
    const jsonDiff = diffJson(input.originalJson as JsonValue, input.correctedJson as JsonValue)
    const textMatches = new Map<string, string>()
    for (const c of collectScalarChanges(jsonDiff)) {
      const b = scalarText(c.before)
      const a = scalarText(c.after)
      if (b.trim() !== '' && a !== b) textMatches.set(b, a)
    }
    const tableDiff = buildTableDiffFromValueMatches(input.originalTables, textMatches)
    return { jsonDiff, tableDiff, changeCount: countNodeChanges(jsonDiff) }
  }

  const correctedTables = input.correctedTables ?? []
  const tableDiff = buildTableDiff(input.originalTables, correctedTables)
  const valueMatches = new Map<string, JsonValue>()
  for (const c of collectCellChanges(tableDiff)) {
    if (c.before.trim() !== '' && c.after !== c.before) {
      valueMatches.set(c.before, coerceCell(c.after) as JsonValue)
    }
  }
  const jsonDiff = diffJsonByValueMatches(input.originalJson as JsonValue, valueMatches)
  return { jsonDiff, tableDiff, changeCount: countTableChanges(tableDiff) }
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

export const diffStyles: Record<'removed' | 'added' | 'arrow', CSSProperties> = {
  removed: { textDecoration: 'line-through', opacity: 0.55 },
  added: {
    fontWeight: 700,
    backgroundColor: 'rgba(34, 197, 94, 0.16)',
    borderRadius: 3,
    padding: '0 3px',
  },
  arrow: { color: 'var(--accent-200)', fontWeight: 600, padding: '0 2px' },
}

const INDENT = '  '

export function renderJsonDiff(node: DiffNode, depth = 0): ReactNode {
  if (node.kind === 'object') {
    if (node.entries.length === 0) {
      return (
        <>
          <span style={tokenColors.punctuation}>{'{'}</span>
          <span style={tokenColors.punctuation}>{'}'}</span>
        </>
      )
    }
    const childIndent = INDENT.repeat(depth + 1)
    const currentIndent = INDENT.repeat(depth)
    return (
      <>
        <span style={tokenColors.punctuation}>{'{'}</span>
        {'\n'}
        {node.entries.map(({ key, node: child }, index) => (
          <Fragment key={key}>
            {childIndent}
            <span style={tokenColors.key}>{JSON.stringify(key)}</span>
            <span style={tokenColors.punctuation}>: </span>
            {renderJsonDiff(child, depth + 1)}
            {index < node.entries.length - 1 && <span style={tokenColors.punctuation}>,</span>}
            {'\n'}
          </Fragment>
        ))}
        {currentIndent}
        <span style={tokenColors.punctuation}>{'}'}</span>
      </>
    )
  }

  if (node.kind === 'array') {
    if (node.items.length === 0) {
      return (
        <>
          <span style={tokenColors.punctuation}>[</span>
          <span style={tokenColors.punctuation}>]</span>
        </>
      )
    }
    const childIndent = INDENT.repeat(depth + 1)
    const currentIndent = INDENT.repeat(depth)
    return (
      <>
        <span style={tokenColors.punctuation}>[</span>
        {'\n'}
        {node.items.map((item, index) => (
          <Fragment key={index}>
            {childIndent}
            {renderJsonDiff(item, depth + 1)}
            {index < node.items.length - 1 && <span style={tokenColors.punctuation}>,</span>}
            {'\n'}
          </Fragment>
        ))}
        {currentIndent}
        <span style={tokenColors.punctuation}>]</span>
      </>
    )
  }

  if (node.status === 'unchanged') return renderJsonValue(node.value, depth)
  if (node.status === 'added') return <span style={diffStyles.added}>{renderJsonValue(node.after, depth)}</span>
  if (node.status === 'removed') return <span style={diffStyles.removed}>{renderJsonValue(node.before, depth)}</span>

  return (
    <span>
      <span style={diffStyles.removed}>{renderJsonValue(node.before, depth)}</span>
      <span style={diffStyles.arrow}>→</span>
      <span style={diffStyles.added}>{renderJsonValue(node.after, depth)}</span>
    </span>
  )
}

/** Inline before/after decoration for a single table cell. */
export function renderCellDiff(cell: CellDiff): ReactNode {
  if (cell.status === 'changed') {
    return (
      <span>
        <span style={diffStyles.removed}>{cell.before || '\u2014'}</span>
        <span style={diffStyles.arrow}> → </span>
        <span style={diffStyles.added}>{cell.after || '\u2014'}</span>
      </span>
    )
  }
  if (cell.status === 'added') return <span style={diffStyles.added}>{cell.after}</span>
  if (cell.status === 'removed') return <span style={diffStyles.removed}>{cell.before}</span>
  return <>{cell.text}</>
}
