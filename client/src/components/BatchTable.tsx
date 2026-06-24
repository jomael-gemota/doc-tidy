import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layers,
  FileText,
  ExternalLink,
  FileSpreadsheet,
  RotateCcw,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import type { Batch, BatchStatus } from '../hooks/useBatches'
import { normalizeTables, tablesToExcel } from '../lib/tableData'

const PAGE_SIZE = 10

interface BatchTableProps {
  batches: Batch[]
  loading: boolean
  error: string | null
  page: number
  onPageChange: (page: number) => void
  onDelete: (id: string) => Promise<void>
  onRerun: (id: string) => Promise<void>
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
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

interface IconBtnProps {
  onClick: () => void
  title: string
  disabled?: boolean
  danger?: boolean
  busy?: boolean
  children: React.ReactNode
}

function IconBtn({ onClick, title, disabled, danger, busy, children }: IconBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded-lg border transition-colors"
      style={{
        borderColor: danger ? 'rgba(239, 68, 68, 0.25)' : 'var(--bg-300)',
        backgroundColor: danger ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-200)',
        color: disabled || busy
          ? 'var(--bg-300)'
          : danger
          ? '#ef4444'
          : 'var(--text-200)',
        cursor: disabled || busy ? 'not-allowed' : 'pointer',
      }}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
    </button>
  )
}

const thStyle = 'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider'
const tdStyle = 'px-4 py-3 align-middle'

export default function BatchTable({
  batches,
  loading,
  error,
  page,
  onPageChange,
  onDelete,
  onRerun,
}: BatchTableProps) {
  const navigate = useNavigate()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const handleDownload = async (batch: Batch) => {
    setDownloadingId(batch._id)
    try {
      const res = await fetch(`/api/jobs/${batch._id}`)
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const job = (await res.json()) as { tableOutput?: Record<string, unknown> | null; filename?: string }
      const tables = normalizeTables(job.tableOutput ?? null)
      tablesToExcel(tables, job.filename ?? batch.filename)
    } catch (err) {
      console.error('[download] failed:', err)
    } finally {
      setDownloadingId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(batches.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const slice = batches.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const startRow = batches.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const endRow = Math.min(safePage * PAGE_SIZE, batches.length)

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }
    setConfirmDeleteId(null)
    setBusyId(id)
    try {
      await onDelete(id)
    } finally {
      setBusyId(null)
    }
  }

  const handleRerun = async (id: string) => {
    setBusyId(id)
    try {
      await onRerun(id)
    } finally {
      setBusyId(null)
    }
  }

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
            {loading ? 'Loading…' : `${batches.length} ${batches.length === 1 ? 'batch' : 'batches'}`}
          </span>
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
        <table className="w-full min-w-[720px] border-collapse text-sm">
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
            {loading && batches.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--accent-200)' }}>
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Loading batches…
                </td>
              </tr>
            )}

            {!loading && batches.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--accent-200)' }}>
                  No documents processed yet. Upload a PDF to create your first batch.
                </td>
              </tr>
            )}

            {slice.map(batch => {
              const isBusy = busyId === batch._id
              const isConfirmingDelete = confirmDeleteId === batch._id

              return (
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
                        className="max-w-[200px] truncate font-medium"
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
                      style={{ color: 'var(--text-200)', borderColor: 'var(--bg-300)', backgroundColor: 'var(--bg-200)' }}
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
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Download Result as Excel */}
                      <IconBtn
                        title="Download Result"
                        onClick={() => handleDownload(batch)}
                        busy={downloadingId === batch._id}
                        disabled={batch.status !== 'completed'}
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" style={{ color: batch.status === 'completed' ? '#16a34a' : undefined }} />
                      </IconBtn>

                      {/* View Extraction Results → job workspace, preserving current table page */}
                      <IconBtn
                        title="View Extraction Results"
                        onClick={() => navigate(`/jobs/${batch._id}`, { state: { returnPage: safePage } })}
                        busy={false}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </IconBtn>

                      {/* Re-run */}
                      <IconBtn
                        title="Re-run"
                        onClick={() => handleRerun(batch._id)}
                        busy={isBusy}
                        disabled={batch.status === 'processing' || !batch.pdfFileId}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </IconBtn>

                      {/* Delete — first click shows confirm; second click deletes */}
                      {isConfirmingDelete ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(batch._id)}
                          className="flex h-7 items-center gap-1 rounded-lg border px-2 text-xs font-semibold transition-colors"
                          style={{
                            borderColor: 'rgba(239, 68, 68, 0.4)',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                          Confirm
                        </button>
                      ) : (
                        <IconBtn
                          title="Delete batch"
                          onClick={() => handleDelete(batch._id)}
                          danger
                          busy={isBusy}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconBtn>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {batches.length > PAGE_SIZE && (
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: '1px solid var(--bg-300)' }}
        >
          <span className="text-xs" style={{ color: 'var(--accent-200)' }}>
            Showing {startRow}–{endRow} of {batches.length}
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, safePage - 1))}
              disabled={safePage === 1}
              className="flex h-7 w-7 items-center justify-center rounded-lg border transition-colors"
              style={{
                borderColor: 'var(--bg-300)',
                backgroundColor: 'var(--bg-200)',
                color: safePage === 1 ? 'var(--bg-300)' : 'var(--text-200)',
                cursor: safePage === 1 ? 'not-allowed' : 'pointer',
              }}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                  acc.push('…')
                }
                acc.push(p)
                return acc
              }, [])
              .map((item, idx) =>
                item === '…' ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="flex h-7 w-7 items-center justify-center text-xs"
                    style={{ color: 'var(--accent-200)' }}
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onPageChange(item as number)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-medium transition-colors"
                    style={{
                      borderColor: safePage === item ? 'var(--primary-100)' : 'var(--bg-300)',
                      backgroundColor: safePage === item ? 'rgba(255, 102, 0, 0.1)' : 'var(--bg-200)',
                      color: safePage === item ? 'var(--primary-100)' : 'var(--text-200)',
                    }}
                  >
                    {item}
                  </button>
                ),
              )}

            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
              disabled={safePage === totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-lg border transition-colors"
              style={{
                borderColor: 'var(--bg-300)',
                backgroundColor: 'var(--bg-200)',
                color: safePage === totalPages ? 'var(--bg-300)' : 'var(--text-200)',
                cursor: safePage === totalPages ? 'not-allowed' : 'pointer',
              }}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
