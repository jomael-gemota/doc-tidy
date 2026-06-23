import { useEffect, useMemo, useRef } from 'react'
import { renderJsonValue, type JsonValue } from '../lib/jsonHighlight'

interface JsonViewProps {
  rawOutput: string
  json: Record<string, unknown> | null
  isActive: boolean
}

/** Body-only JSON renderer used inside OutputPanel's "JSON" tab. */
export default function JsonView({ rawOutput, json, isActive }: JsonViewProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isActive) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [rawOutput, isActive])

  const parsedRawJson = useMemo(() => {
    if (json || !rawOutput.trim()) return null
    try {
      return JSON.parse(rawOutput) as JsonValue
    } catch {
      return null
    }
  }, [json, rawOutput])

  const syntaxTarget = (json as JsonValue | null) ?? parsedRawJson
  const displayContent = syntaxTarget ? JSON.stringify(syntaxTarget, null, 2) : rawOutput

  return (
    <div className="flex-1 min-h-0 p-5">
      <div
        className="h-full overflow-y-auto rounded-xl border p-4"
        style={{
          borderColor: 'var(--bg-300)',
          backgroundColor: '#fcfcfd',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        }}
      >
        <pre
          className="font-mono text-[13px] leading-6 whitespace-pre-wrap break-words sm:text-sm sm:leading-7"
          style={{ margin: 0, color: 'var(--text-200)' }}
        >
          {displayContent ? (
            syntaxTarget ? (
              <span>{renderJsonValue(syntaxTarget)}</span>
            ) : (
              <span style={{ color: 'var(--text-200)' }}>{displayContent}</span>
            )
          ) : (
            <span
              className="text-sm not-italic"
              style={{
                fontFamily: "'Source Sans 3', sans-serif",
                color: 'var(--accent-200)',
              }}
            >
              Structured JSON will appear here once Tidy finishes reasoning…
            </span>
          )}
          {isActive && (
            <span
              className="thinking-cursor"
              style={{ backgroundColor: 'var(--primary-200)' }}
            />
          )}
        </pre>
      </div>
      <div ref={endRef} />
    </div>
  )
}
