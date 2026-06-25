import { useEffect, useState } from 'react'
import { Store, Loader2, Plus, Check, X, RefreshCw } from 'lucide-react'

interface VendorSetupProps {
  jobId: string
  /** May be null when the worker couldn't extract a vendor name but still flagged
   * the job as needing SKU setup — the user supplies the name in that case. */
  vendorName: string | null
  /** The worker flagged this job's vendor as new (no samples resolved). */
  needsSetup?: boolean
}

interface VendorResponse {
  skuSamples?: string[]
  skuSample?: string | null
}

// Per-vendor SKU sample manager shown on completed jobs. A vendor learns its SKU
// format(s) from one or more real sample SKUs (see design-log
// 2026-06-26-decouple-sample-save-from-rerun.md):
//   - Setup mode (no samples yet): prominent card to save the first sample.
//   - Manage mode (>=1 sample): subtle card listing saved samples with an
//     "Add another sample SKU" link plus a remove button per sample.
// Saving never re-runs the job — adding/removing formats is in place. Re-running
// this document is a separate, explicit button; future uploads apply the formats
// automatically (the worker reads samples fresh on every run).
export default function VendorSetup({ jobId, vendorName, needsSetup }: VendorSetupProps) {
  const initialName = (vendorName ?? '').trim()
  // When the worker couldn't name the vendor, the user types it here.
  const knownVendor = initialName.length > 0

  const [samples, setSamples] = useState<string[]>([])
  const [loading, setLoading] = useState(knownVendor)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState(initialName)
  const [skuSample, setSkuSample] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [rerunning, setRerunning] = useState(false)

  // The name we register/look up against: the worker's value when known, else
  // whatever the user has typed.
  const effectiveName = (knownVendor ? initialName : name).trim()

  // Load any samples already saved for this vendor so we know which mode to show
  // (independent of the possibly-stale vendorNeedsSetup flag on the job). Skipped
  // when the vendor is unnamed — there's nothing to look up yet.
  useEffect(() => {
    if (!knownVendor) return
    let cancelled = false
    fetch(`/api/vendors/${encodeURIComponent(initialName)}`)
      .then(r => (r.ok ? r.json() : null))
      .then((v: VendorResponse | null) => {
        if (cancelled) return
        setSamples(mergeSamples(v))
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [initialName, knownVendor])

  const isSetup = samples.length === 0

  const handleSave = async () => {
    if (!knownVendor && !name.trim()) {
      setError('Enter the vendor name first.')
      return
    }
    if (!skuSample.trim()) {
      setError('Paste one real SKU for this vendor.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const vendorRes = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: effectiveName, skuSample: skuSample.trim() }),
      })
      if (!vendorRes.ok) throw new Error('Failed to save the vendor.')
      const updated = (await vendorRes.json().catch(() => null)) as VendorResponse | null

      // Append in place (both setup and manage modes). Saving never re-runs the
      // job — re-running this document is a separate, explicit action.
      setSamples(mergeSamples(updated, [...samples, skuSample.trim()]))
      setSkuSample('')
      setAdding(false)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const handleRerun = async () => {
    setRerunning(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/rerun`, { method: 'POST' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Failed to re-run the document.')
      }
      // Reload so the page re-subscribes to the fresh run's stream.
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setRerunning(false)
    }
  }

  const handleRemove = async (sample: string) => {
    setRemoving(sample)
    setError(null)
    try {
      const res = await fetch(`/api/vendors/${encodeURIComponent(effectiveName)}/sample`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skuSample: sample }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Failed to remove the sample.')
      }
      const updated = (await res.json().catch(() => null)) as VendorResponse | null
      setSamples(mergeSamples(updated, []))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setRemoving(null)
    }
  }

  if (loading) return null

  // Shared input row, reused by both modes.
  const inputRow = (
    <div className="mt-3 flex flex-wrap items-end gap-3">
      {!knownVendor && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium" style={{ color: 'var(--text-200)' }}>
            Vendor name
          </span>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. FitFlop"
            disabled={saving}
            autoFocus
            className="w-56 max-w-full rounded-md border px-2.5 py-1.5 text-sm outline-none"
            style={{ borderColor: 'var(--bg-300)', backgroundColor: 'var(--bg-100)', color: 'var(--text-100)' }}
          />
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium" style={{ color: 'var(--text-200)' }}>
          {isSetup ? 'Sample SKU' : 'New sample SKU'}
        </span>
        <input
          type="text"
          value={skuSample}
          onChange={e => setSkuSample(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !saving) handleSave()
          }}
          placeholder="e.g. K12345-BLK-7.5M"
          disabled={saving}
          autoFocus={!isSetup}
          className="w-80 max-w-full rounded-md border px-2.5 py-1.5 font-mono text-sm outline-none"
          style={{ borderColor: 'var(--bg-300)', backgroundColor: 'var(--bg-100)', color: 'var(--text-100)' }}
        />
      </label>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold text-white transition-colors"
        style={{ backgroundColor: 'var(--primary-100)', opacity: saving ? 0.7 : 1 }}
      >
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {saving ? 'Saving…' : isSetup ? 'Save format' : 'Add sample'}
      </button>
      {!isSetup && !saving && (
        <button
          type="button"
          onClick={() => {
            setAdding(false)
            setSkuSample('')
            setError(null)
          }}
          className="text-xs font-medium underline-offset-2 hover:underline"
          style={{ color: 'var(--accent-200)' }}
        >
          Cancel
        </button>
      )}
    </div>
  )

  // Re-run lives at the section's top-right (manage mode only); rebuilding this
  // document with the current formats is a distinct, noticeable action.
  const rerunButton = (
    <button
      type="button"
      onClick={handleRerun}
      disabled={rerunning}
      title="Rebuild this document's SKUs with the current formats"
      className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors"
      style={{ backgroundColor: 'var(--primary-100)', opacity: rerunning ? 0.7 : 1 }}
    >
      {rerunning ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" />
      )}
      {rerunning ? 'Re-running…' : 'Re-run this document'}
    </button>
  )

  const accent = isSetup ? 'var(--primary-100)' : 'var(--accent-200)'

  return (
    <div
      className="mb-4 rounded-xl border px-4 py-3.5"
      style={
        isSetup
          ? { backgroundColor: 'rgba(255, 102, 0, 0.05)', borderColor: 'rgba(255, 102, 0, 0.22)' }
          : { backgroundColor: 'var(--bg-100)', borderColor: 'var(--bg-300)' }
      }
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: isSetup ? 'rgba(255, 102, 0, 0.1)' : 'var(--bg-200)' }}
        >
          <Store className="h-4 w-4" style={{ color: accent }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>
              {isSetup && needsSetup
                ? effectiveName
                  ? `New vendor: ${effectiveName}`
                  : 'Unrecognized vendor'
                : effectiveName || 'Vendor'}
            </p>
            {!isSetup && rerunButton}
          </div>

          {isSetup ? (
            <>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--accent-200)' }}>
                I extracted the line items and took my best guess at the SKUs.{' '}
                {knownVendor
                  ? 'Paste one real SKU exactly as it should look for this vendor'
                  : 'I couldn\u2019t tell which vendor this is — enter the vendor name and paste one real SKU exactly as it should look'}{' '}
                — I&apos;ll learn the format and apply it to documents I process from now on.
                Saving won&apos;t re-run this one; use Re-run when you&apos;re ready to rebuild it.
              </p>
              {inputRow}
            </>
          ) : (
            <>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--accent-200)' }}>
                I&apos;ve learned this vendor&apos;s SKU format(s) from the sample(s) below and
                apply them to documents I process from now on. Add another sample if this vendor
                uses a different format too. To rebuild <em>this</em> document with the current
                formats, use Re-run.
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {samples.map((s, i) => (
                  <span
                    key={`${s}-${i}`}
                    className="inline-flex items-center gap-1.5 rounded-md border py-1 pl-2 pr-1 font-mono text-xs"
                    style={{
                      color: 'var(--text-200)',
                      borderColor: 'var(--bg-300)',
                      backgroundColor: 'var(--bg-200)',
                    }}
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => handleRemove(s)}
                      disabled={removing !== null}
                      title="Remove this sample"
                      aria-label={`Remove sample ${s}`}
                      className="inline-flex h-4 w-4 items-center justify-center rounded transition-colors hover:bg-[rgba(239,68,68,0.12)]"
                      style={{ color: 'var(--accent-200)' }}
                    >
                      {removing === s ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                    </button>
                  </span>
                ))}
                {justSaved && (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium"
                    style={{ color: '#16a34a' }}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Saved
                  </span>
                )}
              </div>

              {adding ? (
                inputRow
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAdding(true)
                    setError(null)
                  }}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold transition-colors"
                  style={{ color: 'var(--primary-200)' }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add another sample SKU
                </button>
              )}
            </>
          )}

          {error && (
            <p className="mt-2 text-xs font-medium" style={{ color: '#ef4444' }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// Combine the new skuSamples array with the legacy single skuSample, deduped and
// order-preserving. An optional `extra` list is merged in too (optimistic adds).
function mergeSamples(v: VendorResponse | null, extra: string[] = []): string[] {
  const all = [...(v?.skuSamples ?? []), ...(v?.skuSample ? [v.skuSample] : []), ...extra]
  return Array.from(new Set(all.map(s => s.trim()).filter(Boolean)))
}
