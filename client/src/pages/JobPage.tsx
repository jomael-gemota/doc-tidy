import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react'
import { useJobStream } from '../hooks/useJobStream'
import ThinkingStream from '../components/ThinkingStream'
import JsonOutput from '../components/JsonOutput'

const statusConfig = {
  idle: { icon: Clock, color: 'text-slate-400', label: 'Idle' },
  connecting: { icon: Loader2, color: 'text-violet-400', label: 'Connecting…', spin: true },
  processing: { icon: Loader2, color: 'text-violet-400', label: 'Processing…', spin: true },
  completed: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Failed' },
}

export default function JobPage() {
  const { id } = useParams<{ id: string }>()
  const { thinking, output, json, status, error } = useJobStream(id)

  const cfg = statusConfig[status]
  const Icon = cfg.icon
  const isActive = status === 'processing'

  return (
    <div className="min-h-screen flex flex-col bg-[#0f1117]">
      <header className="flex items-center gap-4 px-6 py-4 border-b border-slate-800">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          New document
        </Link>

        <div className="h-4 w-px bg-slate-700" />

        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${'spin' in cfg ? 'animate-spin' : ''} ${cfg.color}`} />
          <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
        </div>

        <span className="ml-auto font-mono text-xs text-slate-600 hidden sm:block">
          job/{id}
        </span>
      </header>

      {error && (
        <div className="mx-6 mt-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 min-h-0" style={{ height: 'calc(100vh - 61px)' }}>
        <div className="flex flex-col min-h-[50vh] lg:min-h-0 overflow-hidden">
          <ThinkingStream content={thinking} isActive={isActive} />
        </div>
        <div className="flex flex-col min-h-[50vh] lg:min-h-0 overflow-hidden">
          <JsonOutput rawOutput={output} json={json} isActive={isActive && output.length > 0} />
        </div>
      </div>
    </div>
  )
}
