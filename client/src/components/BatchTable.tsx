import { Link } from 'react-router-dom'
import {
  Layers,
  FileText,
  RefreshCw,
  Braces,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
} from 'lucide-react'
import type { Batch, BatchStatus } from '../hooks/useBatches'

interface BatchTableProps {
  batches: Batch[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onViewJson: (batch: Batch) => void
}

const statusConfig: Record<
  BatchStatus,
  { label: string; color: string; bg: string; border: string; icon: typeof Clock; spin?: boolean }
> = {
  pending: {
    label: 'Pending',
    color: 'var(--accent-200)',
    bg: 'var(--bg-200)',
    border: 'var(--bg-300)',
    icon: Clock,
  },
  processing: {
    label: 'Processing',
    color: 'var(--primary-100)',
    bg: 'rgba(255, 102, 0, 0.08)',
    border: 'rgba(255, 102, 0, 0.18)',
    icon: Loader2,
    spin: true,
  },
  completed: {
    label: 'Completed',
    color: '#16a34a',
    bg: 'rgba(34, 197, 94, 0.08)',
    border: 'rgba(34, 197, 94, 0.2)',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.08)',
    border: 'rgba(239, 68, 68, 0.2)',
    icon: XCircle,
  },
}

function StatusBadge({ status }: { status: BatchStatus }) {
  const cfg = statusConfig[status]
  const Icon = cfg.icon
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: cfg.bg, borderColor: cfg.border, color: cfg.color }}
    >
      <Icon className={`h-3.5 w-3.5 ${cfg.spin ? 'animate-spin' : ''}`} style={{ color: cfg.color }} />
      {cfg.label}
    </span>
  )
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (!Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return '<1s'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m ${rem}s`
}

const thStyle = 'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider'
const tdStyle = 'px-4 py-3 align-middle'

export default function BatchTable({
  batches,
  loading,
  error,
  onRefresh,
  onViewJson,
}: BatchTableProps) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border shadow-sm"
      style={{
        borderColor: 'var(--bg-300)',
        backgroundColor: 'var(--bg-100)',
        boxShadow: '0 8px 24px rgba(17, 24, 39, 0.06)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-5 py-3.5"
        style={{ borderBottom: '1px solid var(--bg-300)' }}
      >
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ backgroundColor: 'var(--bg-200)' }}
        >
          <Layers className="h-4 w-4" style={{ color: 'var(--text-200)' }} />
        </div>
        <div>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>
            Document Batches
          </span>
          <p className="text-xs leading-none" style={{ color: 'var(--accent-200)' }}>
            All uploaded documents across users
          </p>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs font-medium" style={{ color: 'var(--accent-200)' }}>
            {batches.length} {batches.length === 1 ? 'batch' : 'batches'}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
            style={{
              color: 'var(--text-200)',
              borderColor: 'var(--bg-300)',
              backgroundColor: 'var(--bg-200)',
            }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div
          className="px-5 py-3 text-sm"
          style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.06)' }}
        >
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--bg-300)' }}>
              <th className={thStyle} style={{ color: 'var(--accent-200)' }}>Document</th>
              <th className={thStyle} style={{ color: 'var(--accent-200)' }}>Batch ID</th>
              <th className={thStyle} style={{ color: 'var(--accent-200)' }}>Status</th>
              <th className={thStyle} style={{ color: 'var(--accent-200)' }}>Created</th>
              <th className={thStyle} style={{ color: 'var(--accent-200)' }}>Completed</th>
              <th className={thStyle} style={{ color: 'var(--accent-200)' }}>Duration</th>
              <th className={`${thStyle} text-right`} style={{ color: 'var(--accent-200)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && batches.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--accent-200)' }}>
                  No documents have been processed yet. Upload a PDF to create your first batch.
                </td>
              </tr>
            )}

            {loading && batches.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--accent-200)' }}>
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Loading batches…
                </td>
              </tr>
            )}

            {batches.map(batch => (
              <tr
                key={batch._id}
                className="transition-colors"
                style={{ borderBottom: '1px solid var(--bg-200)' }}
              >
                <td className={tdStyle}>
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: 'rgba(255, 102, 0, 0.08)' }}
                    >
                      <FileText className="h-4 w-4" style={{ color: 'var(--primary-100)' }} />
                    </div>
                    <span
                      className="max-w-[220px] truncate font-medium"
                      style={{ color: 'var(--text-100)' }}
                      title={batch.filename}
                    >
                      {batch.filename}
                    </span>
                  </div>
                </td>
                <td className={tdStyle}>
                  <span
                    className="rounded-md border px-2 py-0.5 font-mono text-xs"
                    style={{
                      color: 'var(--text-200)',
                      borderColor: 'var(--bg-300)',
                      backgroundColor: 'var(--bg-200)',
                    }}
                    title={batch._id}
                  >
                    {batch._id.slice(-8)}
                  </span>
                </td>
                <td className={tdStyle}>
                  <StatusBadge status={batch.status} />
                </td>
                <td className={tdStyle} style={{ color: 'var(--text-200)' }}>
                  {formatDate(batch.createdAt)}
                </td>
                <td className={tdStyle} style={{ color: 'var(--text-200)' }}>
                  {formatDate(batch.completedAt)}
                </td>
                <td className={tdStyle} style={{ color: 'var(--text-200)' }}>
                  {formatDuration(batch.createdAt, batch.completedAt)}
                </td>
                <td className={tdStyle}>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onViewJson(batch)}
                      disabled={!batch.jsonOutput}
                      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
                      style={{
                        color: batch.jsonOutput ? 'var(--text-200)' : 'var(--bg-300)',
                        borderColor: 'var(--bg-300)',
                        backgroundColor: 'var(--bg-200)',
                        cursor: batch.jsonOutput ? 'pointer' : 'not-allowed',
                      }}
                      title={batch.jsonOutput ? 'View JSON output' : 'No JSON output available'}
                    >
                      <Braces className="h-3.5 w-3.5" />
                      View JSON
                    </button>
                    <Link
                      to={`/jobs/${batch._id}`}
                      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
                      style={{
                        color: 'var(--primary-100)',
                        borderColor: 'rgba(255, 102, 0, 0.25)',
                        backgroundColor: 'rgba(255, 102, 0, 0.06)',
                      }}
                    >
                      Open
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
