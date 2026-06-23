import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react'
import { useJobStream } from '../hooks/useJobStream'
import ThinkingStream from '../components/ThinkingStream'
import JsonOutput from '../components/JsonOutput'

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
  const { thinking, output, json, status, error } = useJobStream(id)

  const cfg = statusConfig[status]
  const Icon = cfg.icon
  const isActive = status === 'processing'

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: 'var(--bg-200)' }}>
      <header
        className="sticky top-0 z-10 backdrop-blur-sm"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
          borderBottom: '1px solid var(--bg-300)',
        }}
      >
        <div className="mx-auto w-full max-w-[1360px] px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors"
              style={{ color: 'var(--text-200)' }}
            >
              <ArrowLeft className="h-4 w-4" />
              New document
            </Link>

            <div className="h-5 w-px" style={{ backgroundColor: 'var(--bg-300)' }} />

            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-none" style={{ color: 'var(--text-100)' }}>
                Job Workspace
              </h1>
              <p className="mt-1 text-xs" style={{ color: 'var(--accent-200)' }}>
                Review Tidy reasoning and final structured output
              </p>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
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
              >
                job/{id}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <div className="mx-auto flex h-full min-h-[600px] w-full max-w-[1360px] flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
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
              <JsonOutput rawOutput={output} json={json} isActive={isActive && output.length > 0} />
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
