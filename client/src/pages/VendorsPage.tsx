import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Store,
  Loader2,
  Trash2,
  FileText,
  GitCompareArrows,
  MessageSquareText,
  PackageOpen,
  ExternalLink,
  X,
} from 'lucide-react'
import { renderJsonValue, type JsonValue } from '../lib/jsonHighlight'
import ConfirmModal from '../components/ConfirmModal'

interface Vendor {
  _id: string
  name: string
  normalizedName: string
  skuSamples?: string[]
  skuSample?: string | null
  createdAt: string
  updatedAt: string
}

interface Correction {
  _id: string
  jobId: string
  filename: string
  vendorName: string | null
  originalOutput: Record<string, unknown> | null
  correctedOutput: Record<string, unknown>
  mode?: 'json' | 'tabular'
  note?: string
  createdAt: string
}

// Mirror normalizeVendorName() in server/src/lib/mongodb.ts and
// worker/sku.py so client-side grouping matches the worker's vendor scoping.
function normalizeVendorName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

interface VendorGroup {
  key: string
  name: string
  vendor: Vendor | null
  samples: string[]
  corrections: Correction[]
}

function mergeSamples(v: Vendor): string[] {
  const all = [...(v.skuSamples ?? []), ...(v.skuSample ? [v.skuSample] : [])]
  return Array.from(new Set(all.map(s => s.trim()).filter(Boolean)))
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // The correction being viewed (before/after) and the one pending deletion.
  const [viewing, setViewing] = useState<Correction | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Correction | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // The vendor pending deletion (cascades to its corrections).
  const [pendingVendorDelete, setPendingVendorDelete] = useState<VendorGroup | null>(null)
  const [deletingVendor, setDeletingVendor] = useState(false)
  const [vendorDeleteError, setVendorDeleteError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [vRes, cRes] = await Promise.all([
        fetch('/api/vendors'),
        fetch('/api/corrections'),
      ])
      if (!vRes.ok) throw new Error(`Failed to load vendors (${vRes.status})`)
      if (!cRes.ok) throw new Error(`Failed to load corrections (${cRes.status})`)
      setVendors((await vRes.json()) as Vendor[])
      setCorrections((await cRes.json()) as Correction[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vendors')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  // Group corrections under their registered vendor (by normalized name).
  // Corrections whose vendorName is null or unmatched fall into "Unassigned".
  const { groups, unassigned } = useMemo(() => {
    const byKey = new Map<string, VendorGroup>()
    for (const v of vendors) {
      byKey.set(v.normalizedName, {
        key: v.normalizedName,
        name: v.name,
        vendor: v,
        samples: mergeSamples(v),
        corrections: [],
      })
    }

    const unassignedGroup: Correction[] = []
    for (const c of corrections) {
      const key = c.vendorName ? normalizeVendorName(c.vendorName) : ''
      const group = key ? byKey.get(key) : undefined
      if (group) group.corrections.push(c)
      else unassignedGroup.push(c)
    }

    const sorted = Array.from(byKey.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    )
    return { groups: sorted, unassigned: unassignedGroup }
  }, [vendors, corrections])

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/corrections/${pendingDelete._id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Failed to delete the correction.')
      }
      setCorrections(prev => prev.filter(c => c._id !== pendingDelete._id))
      if (viewing?._id === pendingDelete._id) setViewing(null)
      setPendingDelete(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setDeleting(false)
    }
  }

  const handleConfirmDeleteVendor = async () => {
    if (!pendingVendorDelete?.vendor) return
    const { vendor } = pendingVendorDelete
    setDeletingVendor(true)
    setVendorDeleteError(null)
    try {
      const res = await fetch(`/api/vendors/${encodeURIComponent(vendor.name)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Failed to delete the vendor.')
      }
      setVendors(prev => prev.filter(v => v._id !== vendor._id))
      setCorrections(prev =>
        prev.filter(c => normalizeVendorName(c.vendorName ?? '') !== vendor.normalizedName),
      )
      setPendingVendorDelete(null)
    } catch (err) {
      setVendorDeleteError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setDeletingVendor(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--accent-200)' }} />
      </div>
    )
  }

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
      {error && (
        <div
          className="mb-4 rounded-xl px-4 py-2.5 text-sm"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.06)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
          }}
        >
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* Summary */}
        <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: 'var(--accent-200)' }}>
          <span className="inline-flex items-center gap-1.5">
            <Store className="h-4 w-4" />
            {vendors.length} {vendors.length === 1 ? 'vendor' : 'vendors'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <GitCompareArrows className="h-4 w-4" />
            {corrections.length} {corrections.length === 1 ? 'correction' : 'corrections'}
          </span>
        </div>

        {vendors.length === 0 && corrections.length === 0 && (
          <div
            className="flex flex-col items-center gap-2 rounded-2xl border px-6 py-16 text-center"
            style={{ borderColor: 'var(--bg-300)', backgroundColor: 'var(--bg-100)' }}
          >
            <PackageOpen className="h-8 w-8" style={{ color: 'var(--accent-200)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>
              No vendors captured yet
            </p>
            <p className="text-xs" style={{ color: 'var(--accent-200)' }}>
              Process a document and save a vendor's SKU format to see it here.
            </p>
          </div>
        )}

        {groups.map(group => (
          <VendorCard
            key={group.key}
            group={group}
            onView={setViewing}
            onDelete={c => {
              setDeleteError(null)
              setPendingDelete(c)
            }}
            onDeleteVendor={g => {
              setVendorDeleteError(null)
              setPendingVendorDelete(g)
            }}
          />
        ))}

        {unassigned.length > 0 && (
          <UnassignedCard
            corrections={unassigned}
            onView={setViewing}
            onDelete={c => {
              setDeleteError(null)
              setPendingDelete(c)
            }}
          />
        )}
      </div>

      {viewing && (
        <CorrectionDetailModal correction={viewing} onClose={() => setViewing(null)} />
      )}

      {pendingDelete && (
        <ConfirmModal
          title="Delete correction"
          busy={deleting}
          error={deleteError}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            if (!deleting) setPendingDelete(null)
          }}
          message={
            <>
              Permanently delete the correction from{' '}
              <span className="font-semibold" style={{ color: 'var(--text-100)' }}>
                {pendingDelete.filename}
              </span>
              ? Tidy will stop using it as a learning example on future documents.
              This can&apos;t be undone.
            </>
          }
        />
      )}

      {pendingVendorDelete && (
        <ConfirmModal
          title="Delete vendor"
          busy={deletingVendor}
          error={vendorDeleteError}
          confirmLabel="Delete vendor"
          onConfirm={handleConfirmDeleteVendor}
          onCancel={() => {
            if (!deletingVendor) setPendingVendorDelete(null)
          }}
          message={
            <>
              Permanently delete{' '}
              <span className="font-semibold" style={{ color: 'var(--text-100)' }}>
                {pendingVendorDelete.name}
              </span>
              , including its{' '}
              <span className="font-semibold" style={{ color: 'var(--text-100)' }}>
                {pendingVendorDelete.samples.length} SKU{' '}
                {pendingVendorDelete.samples.length === 1 ? 'format' : 'formats'}
              </span>{' '}
              and{' '}
              <span className="font-semibold" style={{ color: 'var(--text-100)' }}>
                {pendingVendorDelete.corrections.length}{' '}
                {pendingVendorDelete.corrections.length === 1 ? 'correction' : 'corrections'}
              </span>
              ? Tidy will stop using these formats and examples on future documents.
              This can&apos;t be undone.
            </>
          }
        />
      )}
    </div>
  )
}

interface CardCallbacks {
  onView: (c: Correction) => void
  onDelete: (c: Correction) => void
}

function VendorCard({
  group,
  onView,
  onDelete,
  onDeleteVendor,
}: { group: VendorGroup; onDeleteVendor: (g: VendorGroup) => void } & CardCallbacks) {
  return (
    <section
      className="overflow-hidden rounded-2xl border shadow-sm"
      style={{ borderColor: 'var(--bg-300)', backgroundColor: 'var(--bg-100)' }}
    >
      <div
        className="flex flex-wrap items-center gap-3 px-5 py-4"
        style={{ borderBottom: '1px solid var(--bg-300)' }}
      >
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: 'rgba(255, 102, 0, 0.1)' }}
        >
          <Store className="h-5 w-5" style={{ color: 'var(--primary-100)' }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-tight" style={{ color: 'var(--text-100)' }}>
            {group.name}
          </p>
          <p className="text-xs" style={{ color: 'var(--accent-200)' }}>
            {group.corrections.length}{' '}
            {group.corrections.length === 1 ? 'correction' : 'corrections'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDeleteVendor(group)}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-[rgba(239,68,68,0.06)]"
          style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.25)', backgroundColor: 'transparent' }}
          title="Delete this vendor and its corrections"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete vendor
        </button>
      </div>

      {/* SKU sample formats */}
      <div className="px-5 py-4" style={{ borderBottom: group.corrections.length ? '1px solid var(--bg-300)' : 'none' }}>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent-200)' }}>
          SKU formats
        </p>
        {group.samples.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {group.samples.map((s, i) => (
              <span
                key={`${s}-${i}`}
                className="inline-flex items-center rounded-md border px-2 py-1 font-mono text-xs"
                style={{
                  color: 'var(--text-200)',
                  borderColor: 'var(--bg-300)',
                  backgroundColor: 'var(--bg-200)',
                }}
              >
                {s}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs italic" style={{ color: 'var(--accent-200)' }}>
            No SKU samples saved yet.
          </p>
        )}
      </div>

      {group.corrections.length > 0 && (
        <ul className="divide-y" style={{ borderColor: 'var(--bg-300)' }}>
          {group.corrections.map(c => (
            <CorrectionRow key={c._id} correction={c} onView={onView} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </section>
  )
}

function UnassignedCard({
  corrections,
  onView,
  onDelete,
}: { corrections: Correction[] } & CardCallbacks) {
  return (
    <section
      className="overflow-hidden rounded-2xl border shadow-sm"
      style={{ borderColor: 'var(--bg-300)', backgroundColor: 'var(--bg-100)' }}
    >
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{ borderBottom: '1px solid var(--bg-300)' }}
      >
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: 'var(--bg-200)' }}
        >
          <PackageOpen className="h-5 w-5" style={{ color: 'var(--accent-200)' }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-tight" style={{ color: 'var(--text-100)' }}>
            Unassigned
          </p>
          <p className="text-xs" style={{ color: 'var(--accent-200)' }}>
            Corrections not tied to a registered vendor
          </p>
        </div>
      </div>
      <ul className="divide-y" style={{ borderColor: 'var(--bg-300)' }}>
        {corrections.map(c => (
          <CorrectionRow
            key={c._id}
            correction={c}
            showVendorName
            onView={onView}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </section>
  )
}

function CorrectionRow({
  correction,
  showVendorName,
  onView,
  onDelete,
}: { correction: Correction; showVendorName?: boolean } & CardCallbacks) {
  return (
    <li className="flex flex-wrap items-start gap-3 px-5 py-3.5">
      <FileText className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: 'var(--accent-200)' }} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/jobs/${correction.jobId}`}
            className="inline-flex items-center gap-1 truncate text-sm font-semibold transition-colors hover:underline"
            style={{ color: 'var(--text-100)' }}
            title={`Open ${correction.filename}`}
          >
            {correction.filename}
            <ExternalLink className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--accent-200)' }} />
          </Link>
          {showVendorName && correction.vendorName && (
            <span
              className="rounded-md border px-1.5 py-0.5 text-[11px] font-medium"
              style={{ color: 'var(--accent-200)', borderColor: 'var(--bg-300)', backgroundColor: 'var(--bg-200)' }}
            >
              {correction.vendorName}
            </span>
          )}
          <span className="text-xs" style={{ color: 'var(--accent-200)' }}>
            {formatDate(correction.createdAt)}
          </span>
        </div>
        {correction.note && (
          <p
            className="mt-1 inline-flex items-start gap-1.5 text-xs"
            style={{ color: 'var(--text-200)' }}
          >
            <MessageSquareText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--primary-200)' }} />
            <span>{correction.note}</span>
          </p>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => onView(correction)}
          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
          style={{ color: 'var(--text-200)', borderColor: 'var(--bg-300)', backgroundColor: 'var(--bg-200)' }}
        >
          <GitCompareArrows className="h-3.5 w-3.5" />
          View
        </button>
        <button
          type="button"
          onClick={() => onDelete(correction)}
          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-[rgba(239,68,68,0.06)]"
          style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.25)', backgroundColor: 'transparent' }}
          title="Delete this correction"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
    </li>
  )
}

function CorrectionDetailModal({
  correction,
  onClose,
}: {
  correction: Correction
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(17, 24, 39, 0.45)' }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border shadow-xl"
        style={{ borderColor: 'var(--bg-300)', backgroundColor: 'var(--bg-100)' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center gap-2.5 px-5 py-3.5"
          style={{ borderBottom: '1px solid var(--bg-300)' }}
        >
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: 'rgba(255, 152, 63, 0.12)' }}
          >
            <GitCompareArrows className="h-4 w-4" style={{ color: 'var(--primary-200)' }} />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>
              Correction
            </span>
            <p className="truncate text-xs leading-none" style={{ color: 'var(--accent-200)' }}>
              {correction.filename}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5"
            style={{ color: 'var(--accent-200)' }}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {correction.note && (
            <div
              className="mb-4 flex items-start gap-2 rounded-xl px-3.5 py-2.5"
              style={{ backgroundColor: 'rgba(255, 102, 0, 0.05)', border: '1px solid rgba(255, 102, 0, 0.2)' }}
            >
              <MessageSquareText className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: 'var(--primary-200)' }} />
              <p className="text-xs" style={{ color: 'var(--text-200)' }}>
                {correction.note}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <JsonBlock label="Original" json={(correction.originalOutput as JsonValue | null) ?? null} muted />
            <JsonBlock label="Corrected" json={correction.correctedOutput as JsonValue} />
          </div>
        </div>
      </div>
    </div>
  )
}

function JsonBlock({
  label,
  json,
  muted,
}: {
  label: string
  json: JsonValue | null
  muted?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <p
        className="mb-1.5 text-[11px] font-bold uppercase tracking-widest"
        style={{ color: muted ? 'var(--accent-200)' : 'var(--primary-200)' }}
      >
        {label}
      </p>
      <div
        className="overflow-x-auto rounded-xl border p-4"
        style={{ borderColor: 'var(--bg-300)', backgroundColor: '#fcfcfd' }}
      >
        {json !== null ? (
          <pre
            className="font-mono text-[13px] leading-6 whitespace-pre-wrap break-words"
            style={{ margin: 0, color: 'var(--text-200)' }}
          >
            {renderJsonValue(json)}
          </pre>
        ) : (
          <p className="text-xs italic" style={{ color: 'var(--accent-200)' }}>
            No original output recorded.
          </p>
        )}
      </div>
    </div>
  )
}
