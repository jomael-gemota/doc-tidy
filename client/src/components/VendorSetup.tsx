import { useEffect, useState } from 'react'
import { Store, Loader2, Plus, Check, X } from 'lucide-react'

interface VendorSetupProps {
  jobId: string
  vendorName: string
  /** The worker flagged this job's vendor as new (no samples resolved). */
  needsSetup?: boolean
}

interface VendorResponse {
  skuSamples?: string[]
  skuSample?: string | null
}

// Per-vendor SKU sample manager shown on completed jobs. A vendor learns its SKU
// format(s) from one or more real sample SKUs (see design-log
// 2026-06-26-multiple-vendor-sku-samples.md):
//   - Setup mode (no samples yet): prominent card; saving the first sample also
//     re-runs the job so this document's SKUs rebuild with the learned format.
//   - Manage mode (>=1 sample): subtle card listing saved samples with an
//     "Add another sample SKU" link that reveals the input to append more.
export default function VendorSetup({ jobId, vendorName, needsSetup }: VendorSetupProps) {
  const [samples, setSamples] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [skuSample, setSkuSample] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  // Load any samples already saved for this vendor so we know which mode to show
  // (independent of the possibly-stale vendorNeedsSetup flag on the job).
  useEffect(() => {
    let cancelled = false
    fetch(`/api/vendors/${encodeURIComponent(vendorName)}`)
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
  }, [vendorName])

  const isSetup = samples.length === 0

  const handleSave = async () => {
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
        body: JSON.stringify({ name: vendorName, skuSample: skuSample.trim() }),
      })
      if (!vendorRes.ok) throw new Error('Failed to save the vendor.')
      const updated = (await vendorRes.json().catch(() => null)) as VendorResponse | null

      if (isSetup) {
        // First sample for a new vendor: re-run so this document's best-guess
        // SKUs rebuild with the learned format, then reload onto the fresh run.
        const rerunRes = await fetch(`/api/jobs/${jobId}/rerun`, { method: 'POST' })
        if (!rerunRes.ok) {
          const body = (await rerunRes.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error ?? 'Saved the vendor, but re-running the job failed.')
        }
        window.location.reload()
        return
      }

      // Manage mode: append in place without disrupting the completed view.
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

  const handleRemove = async (sample: string) => {
    setRemoving(sample)
    setError(null)
    try {
      const res = await fetch(`/api/vendors/${encodeURIComponent(vendorName)}/sample`, {
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
        {saving ? 'Saving…' : isSetup ? 'Save & learn format' : 'Add sample'}
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
          <p className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>
            {isSetup && needsSetup ? `New vendor: ${vendorName}` : vendorName}
          </p>

          {isSetup ? (
            <>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--accent-200)' }}>
                I extracted the line items and took my best guess at the SKUs. Paste one real
                SKU exactly as it should look for this vendor — I&apos;ll learn the format and
                reproduce it for every row, and remember it next time.
              </p>
              {inputRow}
            </>
          ) : (
            <>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--accent-200)' }}>
                I&apos;ve learned this vendor&apos;s SKU format from the sample(s) below. If this
                vendor uses a different format too, add another sample and I&apos;ll learn that
                one as well.
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
