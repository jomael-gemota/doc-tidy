import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle2, XCircle, Loader2, Clock, FileText, Bot, ArrowLeft } from 'lucide-react'
import { useJobStream } from '../hooks/useJobStream'
import ThinkingStream from '../components/ThinkingStream'
import OutputPanel from '../components/OutputPanel'
import VendorSetup from '../components/VendorSetup'

const statusConfig = {
  idle: {
    icon: Clock,
    label: 'Idle',
    color: 'var(--accent-200)',
    badgeBackground: 'var(--bg-200)',
    badgeBorder: 'var(--bg-300)',
  },
  connecting: {
    icon: Loader2,
    label: 'Connecting…',
    spin: true,
    color: 'var(--primary-100)',
    badgeBackground: 'rgba(255, 102, 0, 0.08)',
    badgeBorder: 'rgba(255, 102, 0, 0.18)',
  },
  processing: {
    icon: Loader2,
    label: 'Processing…',
    spin: true,
    color: 'var(--primary-100)',
    badgeBackground: 'rgba(255, 102, 0, 0.08)',
    badgeBorder: 'rgba(255, 102, 0, 0.18)',
  },
  completed: {
    icon: CheckCircle2,
    label: 'Completed',
    color: '#22c55e',
    badgeBackground: 'rgba(34, 197, 94, 0.08)',
    badgeBorder: 'rgba(34, 197, 94, 0.2)',
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    color: '#ef4444',
    badgeBackground: 'rgba(239, 68, 68, 0.08)',
    badgeBorder: 'rgba(239, 68, 68, 0.2)',
  },
}

export default function JobPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const returnPage = (location.state as { returnPage?: number } | null)?.returnPage ?? 1
  const { thinking, output, json, table, status, error } = useJobStream(id)
  const [filename, setFilename] = useState<string | null>(null)
  const [vendorName, setVendorName] = useState<string | null>(null)
  const [vendorNeedsSetup, setVendorNeedsSetup] = useState(false)

  // Fetch the job document once to get the filename and any persisted data.
  useEffect(() => {
    if (!id) return
    fetch(`/api/jobs/${id}`)
      .then(r => r.json())
      .then((job: { filename?: string; vendorName?: string | null; vendorNeedsSetup?: boolean }) => {
        if (job.filename) setFilename(job.filename)
        setVendorName(job.vendorName ?? null)
        setVendorNeedsSetup(!!job.vendorNeedsSetup)
      })
      .catch(() => {})
  }, [id])

  const cfg = statusConfig[status]
  const Icon = cfg.icon
  const isActive = status === 'processing'

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: 'var(--bg-200)' }}>
      {/* Inner context bar — document identity + live status */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 backdrop-blur-sm sm:px-6"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
          borderBottom: '1px solid var(--bg-300)',
        }}
      >
        {/* Back to IDP */}
        <button
          type="button"
          onClick={() => navigate('/', { state: { page: returnPage } })}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
          style={{
            color: 'var(--text-200)',
            backgroundColor: 'var(--bg-200)',
            border: '1px solid var(--bg-300)',
          }}
          title="Back to Document Batches"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Back</span>
        </button>

        {/* Document identity */}
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: 'rgba(255, 102, 0, 0.08)' }}
        >
          <FileText className="h-4 w-4" style={{ color: 'var(--primary-100)' }} />
        </div>

        <div className="min-w-0">
          <p
            className="truncate text-sm font-semibold leading-tight"
            style={{ color: 'var(--text-100)' }}
            title={filename ?? id}
          >
            {filename ?? 'Loading…'}
          </p>
          <div className="flex items-center gap-1.5">
            <Bot className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--accent-200)' }} />
            <span className="text-xs" style={{ color: 'var(--accent-200)' }}>
              Processed by Tidy Agent
            </span>
          </div>
        </div>

        {/* Right: status badge + batch ID */}
        <div className="ml-auto flex items-center gap-2">
          <div
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5"
            style={{
              backgroundColor: cfg.badgeBackground,
              borderColor: cfg.badgeBorder,
            }}
          >
            <Icon
              className={`h-3.5 w-3.5 ${'spin' in cfg ? 'animate-spin' : ''}`}
              style={{ color: cfg.color }}
            />
            <span className="text-xs font-semibold" style={{ color: cfg.color }}>
              {cfg.label}
            </span>
          </div>

          <span
            className="hidden rounded-full border px-2.5 py-1 font-mono text-xs md:block"
            style={{
              color: 'var(--text-200)',
              borderColor: 'var(--bg-300)',
              backgroundColor: 'var(--bg-100)',
            }}
            title={id}
          >
            {id}
          </span>
        </div>
      </div>

      <main className="min-h-0 flex-1">
        <div className="flex h-full min-h-[600px] w-full flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          {error && (
            <div
              className="mb-4 rounded-xl border px-4 py-3 text-sm"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.06)',
                borderColor: 'rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
              }}
            >
              {error}
            </div>
          )}

          {id && status === 'completed' && (vendorName || vendorNeedsSetup) && (
            <VendorSetup jobId={id} vendorName={vendorName} needsSetup={vendorNeedsSetup} />
          )}

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-5">
            <section
              className="min-h-[52vh] overflow-hidden rounded-2xl border shadow-sm lg:col-span-2 lg:min-h-0"
              style={{
                borderColor: 'var(--bg-300)',
                backgroundColor: 'var(--bg-100)',
                boxShadow: '0 8px 24px rgba(17, 24, 39, 0.06)',
              }}
            >
              <ThinkingStream content={thinking} isActive={isActive} />
            </section>

            <section
              className="min-h-[52vh] overflow-hidden rounded-2xl border shadow-sm lg:col-span-3 lg:min-h-0"
              style={{
                borderColor: 'var(--bg-300)',
                backgroundColor: 'var(--bg-100)',
                boxShadow: '0 8px 24px rgba(17, 24, 39, 0.06)',
              }}
            >
              <OutputPanel
                rawOutput={output}
                json={json}
                table={table}
                isActive={isActive && output.length > 0}
                isProcessing={isActive}
                filename={filename ?? undefined}
                jobId={id}
              />
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
