import { Fragment } from 'react'
import type { CSSProperties, ReactNode } from 'react'

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export const tokenColors: Record<
  'punctuation' | 'key' | 'string' | 'number' | 'literal',
  CSSProperties
> = {
  punctuation: { color: 'var(--text-200)' },
  key: { color: '#c2410c' },
  string: { color: '#0f766e' },
  number: { color: '#2563eb' },
  literal: { color: '#9333ea' },
}

const INDENT = '  '

export function renderJsonValue(value: JsonValue, depth = 0): ReactNode {
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

// Tokenize RAW (possibly invalid / mid-edit) JSON text for a live editor overlay.
// renderJsonValue() only works on already-parsed values; while the user is typing
// the text may not parse, so we colorize with a forgiving regex tokenizer instead.
// Whitespace and unmatched text are preserved verbatim so the overlay lines up
// exactly with the textarea on top of it.
const JSON_TOKEN_RE =
  /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])/g

export function highlightJson(text: string): ReactNode {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let key = 0
  JSON_TOKEN_RE.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = JSON_TOKEN_RE.exec(text)) !== null) {
    const [full, str, colon, num, literal, punctuation] = match
    if (match.index > lastIndex) {
      nodes.push(<Fragment key={key++}>{text.slice(lastIndex, match.index)}</Fragment>)
    }

    if (str !== undefined) {
      if (colon) {
        // A string immediately followed by a colon is an object key.
        nodes.push(
          <span key={key++} style={tokenColors.key}>
            {str}
          </span>,
        )
        nodes.push(
          <span key={key++} style={tokenColors.punctuation}>
            {colon}
          </span>,
        )
      } else {
        nodes.push(
          <span key={key++} style={tokenColors.string}>
            {str}
          </span>,
        )
      }
    } else if (num !== undefined) {
      nodes.push(
        <span key={key++} style={tokenColors.number}>
          {num}
        </span>,
      )
    } else if (literal !== undefined) {
      nodes.push(
        <span key={key++} style={tokenColors.literal}>
          {literal}
        </span>,
      )
    } else if (punctuation !== undefined) {
      nodes.push(
        <span key={key++} style={tokenColors.punctuation}>
          {punctuation}
        </span>,
      )
    }

    lastIndex = match.index + full.length
  }

  if (lastIndex < text.length) {
    nodes.push(<Fragment key={key}>{text.slice(lastIndex)}</Fragment>)
  }

  return nodes
}
