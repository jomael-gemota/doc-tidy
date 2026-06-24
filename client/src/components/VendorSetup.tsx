import { useState } from 'react'
import { Store, Loader2 } from 'lucide-react'

interface VendorSetupProps {
  jobId: string
  vendorName: string
}

// Shown when the worker flagged a job's vendor as new (no SKU initial yet).
// Captures the one-time per-vendor setup, then re-runs the job so SKUs build.
export default function VendorSetup({ jobId, vendorName }: VendorSetupProps) {
  const [skuInitial, setSkuInitial] = useState('')
  const [skuFormat, setSkuFormat] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!skuInitial.trim()) {
      setError('Enter the SKU initial for this vendor.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const vendorRes = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: vendorName,
          skuInitial: skuInitial.trim(),
          skuFormat: skuFormat.trim() || null,
        }),
      })
      if (!vendorRes.ok) throw new Error('Failed to save the vendor.')

      const rerunRes = await fetch(`/api/jobs/${jobId}/rerun`, { method: 'POST' })
      if (!rerunRes.ok) {
        const body = (await rerunRes.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Saved the vendor, but re-running the job failed.')
      }
      // Reload so the stream re-subscribes to the fresh run.
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSaving(false)
    }
  }

  return (
    <div
      className="mb-4 rounded-xl border px-4 py-3.5"
      style={{
        backgroundColor: 'rgba(255, 102, 0, 0.05)',
        borderColor: 'rgba(255, 102, 0, 0.22)',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: 'rgba(255, 102, 0, 0.1)' }}
        >
          <Store className="h-4 w-4" style={{ color: 'var(--primary-100)' }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>
            New vendor: {vendorName}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--accent-200)' }}>
            I extracted the line items but need this vendor&apos;s SKU initial before I can
            build SKUs. Set it once and I&apos;ll remember it.
          </p>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium" style={{ color: 'var(--text-200)' }}>
                SKU initial
              </span>
              <input
                type="text"
                value={skuInitial}
                onChange={e => setSkuInitial(e.target.value)}
                placeholder="e.g. K"
                disabled={saving}
                className="w-24 rounded-md border px-2.5 py-1.5 text-sm outline-none"
                style={{ borderColor: 'var(--bg-300)', backgroundColor: 'var(--bg-100)', color: 'var(--text-100)' }}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium" style={{ color: 'var(--text-200)' }}>
                SKU format <span style={{ color: 'var(--accent-200)' }}>(optional)</span>
              </span>
              <input
                type="text"
                value={skuFormat}
                onChange={e => setSkuFormat(e.target.value)}
                placeholder="{initial}{styleNumber}{colorCode}{size}{width}"
                disabled={saving}
                className="w-80 max-w-full rounded-md border px-2.5 py-1.5 font-mono text-xs outline-none"
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
              {saving ? 'Saving…' : 'Save & build SKUs'}
            </button>
          </div>

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
