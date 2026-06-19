import { useEffect, useRef } from 'react'
import { Brain } from 'lucide-react'

interface ThinkingStreamProps {
  content: string
  isActive: boolean
}

export default function ThinkingStream({ content, isActive }: ThinkingStreamProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [content])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/60">
        <div className={`
          w-7 h-7 rounded-lg flex items-center justify-center
          ${isActive ? 'bg-violet-500/20' : 'bg-slate-700'}
        `}>
          <Brain className={`w-4 h-4 ${isActive ? 'text-violet-400' : 'text-slate-500'}`} />
        </div>
        <span className="text-sm font-medium text-slate-300">Tidy's Reasoning</span>
        {isActive && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-violet-400">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            Thinking…
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed text-slate-400 whitespace-pre-wrap break-words">
        {content || (
          <span className="text-slate-600 italic">
            Agent reasoning will appear here once processing begins…
          </span>
        )}
        {isActive && <span className="thinking-cursor" />}
        <div ref={endRef} />
      </div>
    </div>
  )
}
