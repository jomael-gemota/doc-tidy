import { useEffect, useRef, useState } from 'react'
import { Code2, Copy, Check } from 'lucide-react'

interface JsonOutputProps {
  rawOutput: string
  json: Record<string, unknown> | null
  isActive: boolean
}

export default function JsonOutput({ rawOutput, json, isActive }: JsonOutputProps) {
  const [copied, setCopied] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isActive) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [rawOutput, isActive])

  const displayContent = json
    ? JSON.stringify(json, null, 2)
    : rawOutput

  const handleCopy = async () => {
    if (!displayContent) return
    await navigator.clipboard.writeText(displayContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/60">
        <div className={`
          w-7 h-7 rounded-lg flex items-center justify-center
          ${isActive ? 'bg-emerald-500/20' : 'bg-slate-700'}
        `}>
          <Code2 className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
        </div>
        <span className="text-sm font-medium text-slate-300">JSON Output</span>
        {isActive && !json && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Writing…
          </span>
        )}
        {json && (
          <button
            type="button"
            onClick={handleCopy}
            className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            {copied ? (
              <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied</>
            ) : (
              <><Copy className="w-3.5 h-3.5" /> Copy</>
            )}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
        {displayContent ? (
          <span className={json ? 'text-emerald-300' : 'text-slate-400'}>
            {displayContent}
          </span>
        ) : (
          <span className="text-slate-600 italic">
            Structured JSON will appear here once Tidy finishes reasoning…
          </span>
        )}
        {isActive && <span className="thinking-cursor" style={{ backgroundColor: '#34d399' }} />}
        <div ref={endRef} />
      </div>
    </div>
  )
}
