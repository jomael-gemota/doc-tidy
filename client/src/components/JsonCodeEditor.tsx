import { useRef } from 'react'
import { highlightJson } from '../lib/jsonHighlight'

interface JsonCodeEditorProps {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}

// Shared text metrics — the highlight overlay and the textarea on top of it MUST
// use identical font, size, line-height, padding and white-space, or the colored
// text will drift out from under the caret. Change them here in one place.
const FONT_FAMILY =
  "'SFMono-Regular', 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace"
const FONT_SIZE = 13
const LINE_HEIGHT = 21
const PADDING_Y = 12
const PADDING_X = 14
const GUTTER_WIDTH = 48
const TAB = '  '

// A lightweight VS Code–style JSON editor: a transparent <textarea> layered over
// a scroll-synced, syntax-highlighted <pre>, plus a line-number gutter. No editor
// dependency (CodeMirror/Monaco) — see design-log/2026-06-26-mode-aware-correction-editor.md.
export default function JsonCodeEditor({ value, onChange, disabled }: JsonCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)

  const lineCount = Math.max(value.split('\n').length, 1)

  // Keep the overlay and gutter aligned with the textarea as the user scrolls.
  const syncScroll = () => {
    const ta = textareaRef.current
    if (!ta) return
    if (overlayRef.current) {
      overlayRef.current.scrollTop = ta.scrollTop
      overlayRef.current.scrollLeft = ta.scrollLeft
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = ta.scrollTop
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const ta = e.currentTarget
    const { selectionStart, selectionEnd } = ta
    const next = value.slice(0, selectionStart) + TAB + value.slice(selectionEnd)
    onChange(next)
    // Restore the caret after the inserted spaces on the next paint.
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = selectionStart + TAB.length
    })
  }

  const sharedTextStyle: React.CSSProperties = {
    margin: 0,
    border: 0,
    fontFamily: FONT_FAMILY,
    fontSize: FONT_SIZE,
    lineHeight: `${LINE_HEIGHT}px`,
    padding: `${PADDING_Y}px ${PADDING_X}px`,
    whiteSpace: 'pre',
    tabSize: 2,
    letterSpacing: 0,
  }

  return (
    <div
      className="flex min-h-0 flex-1 overflow-hidden rounded-lg border"
      style={{ borderColor: 'var(--bg-300)', backgroundColor: '#fcfcfd' }}
    >
      {/* Line-number gutter */}
      <div
        ref={gutterRef}
        aria-hidden
        className="flex-shrink-0 overflow-hidden select-none text-right"
        style={{
          width: GUTTER_WIDTH,
          backgroundColor: 'var(--bg-200)',
          borderRight: '1px solid var(--bg-300)',
          color: 'var(--accent-200)',
          fontFamily: FONT_FAMILY,
          fontSize: FONT_SIZE,
          lineHeight: `${LINE_HEIGHT}px`,
          padding: `${PADDING_Y}px 8px`,
        }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>

      {/* Code area: highlighted overlay + transparent textarea */}
      <div className="relative min-w-0 flex-1">
        <pre
          ref={overlayRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-auto"
          style={{ ...sharedTextStyle, color: 'var(--text-200)' }}
        >
          {highlightJson(value)}
          {'\n'}
        </pre>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          className="absolute inset-0 resize-none overflow-auto bg-transparent outline-none"
          style={{
            ...sharedTextStyle,
            color: 'transparent',
            caretColor: 'var(--primary-100)',
          }}
        />
      </div>
    </div>
  )
}
