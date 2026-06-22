import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Code2, Copy, Check } from 'lucide-react'

interface JsonOutputProps {
  rawOutput: string
  json: Record<string, unknown> | null
  isActive: boolean
}

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

const tokenColors: Record<'punctuation' | 'key' | 'string' | 'number' | 'literal', CSSProperties> = {
  punctuation: { color: 'var(--text-200)' },
  key: { color: '#c2410c' },
  string: { color: '#0f766e' },
  number: { color: '#2563eb' },
  literal: { color: '#9333ea' },
}

const INDENT = '  '

function renderJsonValue(value: JsonValue, depth = 0): ReactNode {
  if (value === null) {
    return <span style={tokenColors.literal}>null</span>
  }

  if (typeof value === 'string') {
    return <span style={tokenColors.string}>{JSON.stringify(value)}</span>
  }

  if (typeof value === 'number') {
    return <span style={tokenColors.number}>{String(value)}</span>
  }

  if (typeof value === 'boolean') {
    return <span style={tokenColors.literal}>{String(value)}</span>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <>
          <span style={tokenColors.punctuation}>[</span>
          <span style={tokenColors.punctuation}>]</span>
        </>
      )
    }

    const childIndent = INDENT.repeat(depth + 1)
    const currentIndent = INDENT.repeat(depth)

    return (
      <>
        <span style={tokenColors.punctuation}>[</span>
        {'\n'}
        {value.map((item, index) => (
          <Fragment key={index}>
            {childIndent}
            {renderJsonValue(item, depth + 1)}
            {index < value.length - 1 && <span style={tokenColors.punctuation}>,</span>}
            {'\n'}
          </Fragment>
        ))}
        {currentIndent}
        <span style={tokenColors.punctuation}>]</span>
      </>
    )
  }

  const entries = Object.entries(value)
  if (entries.length === 0) {
    return (
      <>
        <span style={tokenColors.punctuation}>{'{'}</span>
        <span style={tokenColors.punctuation}>{'}'}</span>
      </>
    )
  }

  const childIndent = INDENT.repeat(depth + 1)
  const currentIndent = INDENT.repeat(depth)

  return (
    <>
      <span style={tokenColors.punctuation}>{'{'}</span>
      {'\n'}
      {entries.map(([key, entryValue], index) => (
        <Fragment key={key}>
          {childIndent}
          <span style={tokenColors.key}>{JSON.stringify(key)}</span>
          <span style={tokenColors.punctuation}>: </span>
          {renderJsonValue(entryValue, depth + 1)}
          {index < entries.length - 1 && <span style={tokenColors.punctuation}>,</span>}
          {'\n'}
        </Fragment>
      ))}
      {currentIndent}
      <span style={tokenColors.punctuation}>{'}'}</span>
    </>
  )
}

export default function JsonOutput({ rawOutput, json, isActive }: JsonOutputProps) {
  const [copied, setCopied] = useState(false)
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
  const displayContent = syntaxTarget
    ? JSON.stringify(syntaxTarget, null, 2)
    : rawOutput

  const handleCopy = async () => {
    if (!displayContent) return
    await navigator.clipboard.writeText(displayContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: 'var(--bg-100)' }}>
      {/* Panel header */}
      <div
        className="flex flex-shrink-0 items-center gap-2.5 px-5 py-3.5"
        style={{
          borderBottom: '1px solid var(--bg-300)',
          backgroundColor: 'var(--bg-100)',
        }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: isActive
              ? 'rgba(255, 152, 63, 0.12)'
              : 'var(--bg-200)',
          }}
        >
          <Code2
            className="w-4 h-4"
            style={{ color: isActive ? 'var(--primary-200)' : 'var(--accent-200)' }}
          />
        </div>
        <div>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>
            JSON Output
          </span>
          <p className="text-xs leading-none" style={{ color: 'var(--accent-200)' }}>
            Structured result from Tidy
          </p>
        </div>

        {isActive && !json && (
          <span
            className="ml-auto flex items-center gap-1.5 text-xs font-medium"
            style={{ color: 'var(--primary-200)' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: 'var(--primary-200)' }}
            />
            Writing…
          </span>
        )}

        {json && (
          <button
            type="button"
            onClick={handleCopy}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
            style={{
              color: copied ? '#22c55e' : 'var(--text-200)',
              borderColor: copied ? 'rgba(34, 197, 94, 0.35)' : 'var(--bg-300)',
              backgroundColor: copied ? 'rgba(34, 197, 94, 0.05)' : 'var(--bg-200)',
            }}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy
              </>
            )}
          </button>
        )}
      </div>

      {/* Code content */}
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
    </div>
  )
}
