import { useEffect, useRef, useState } from 'react'
import { Brain, Check } from 'lucide-react'

interface ReasoningStepperProps {
  content: string
  isActive: boolean
}

function parseSteps(content: string): string[] {
  return content
    .split(/\n\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

function shortLabel(step: string): string {
  const firstLine = step.split('\n')[0].replace(/^[\d.)\-\s]+/, '').trim()
  if (firstLine.length <= 28) return firstLine
  return `${firstLine.slice(0, 28).trimEnd()}…`
}

/**
 * Compact inline horizontal stepper — rendered inside a parent card, no wrapper of its own.
 * Hidden entirely when there is no content and the agent is idle.
 */
export default function ReasoningStepper({ content, isActive }: ReasoningStepperProps) {
  const steps = parseSteps(content)
  const hasContent = steps.length > 0
  const lastIndex = steps.length - 1

  const [selected, setSelected] = useState<number | null>(null)
  const railRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isActive && railRef.current) {
      railRef.current.scrollLeft = railRef.current.scrollWidth
    }
  }, [content, isActive])

  if (!hasContent && !isActive) return null

  const activeIndex = selected ?? lastIndex
  const detail = hasContent ? steps[Math.min(activeIndex, lastIndex)] : ''

  return (
    <div style={{ borderTop: '1px solid var(--bg-300)' }}>
      {/* Strip header */}
      <div className="flex items-center gap-2 px-5 py-2.5">
        <div
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: isActive ? 'rgba(255, 102, 0, 0.1)' : 'rgba(34, 197, 94, 0.1)' }}
        >
          <Brain
            className="h-3 w-3"
            style={{ color: isActive ? 'var(--primary-100)' : '#22c55e' }}
          />
        </div>
        <span className="text-xs font-semibold" style={{ color: 'var(--text-200)' }}>
          Tidy Agent Processing
        </span>
        {isActive && (
          <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--primary-100)' }}>
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--primary-100)' }} />
            Thinking…
          </span>
        )}
        {!isActive && hasContent && (
          <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: '#22c55e' }}>
            <Check className="h-3 w-3" />
            Done · {steps.length} steps
          </span>
        )}
      </div>

      {hasContent && (
        <>
          {/* Scrollable stepper rail — pt-3 ensures the ping ring isn't clipped at the top */}
          <div ref={railRef} className="overflow-x-auto px-5 pt-3 pb-3">
            <ol className="flex min-w-max items-start">
              {steps.map((step, i) => {
                const isLast = i === lastIndex
                const isCurrent = isLast && isActive
                const isDone = !isCurrent
                const isSelected = i === activeIndex

                // Connector after this node: green if both this and next are done, grey otherwise
                const connectorGreen = isDone && i < lastIndex

                return (
                  <li key={i} className="flex items-start">
                    <button
                      type="button"
                      onClick={() => setSelected(i)}
                      className="flex flex-col items-center gap-1.5 stepper-step"
                      style={{
                        animationDelay: `${Math.min(i * 40, 200)}ms`,
                        width: '80px',
                      }}
                    >
                      {/* Step circle — wrapper is 30px so the ping ring fits inside it */}
                      <div className="relative flex items-center justify-center" style={{ width: '30px', height: '30px' }}>
                        {/* Pulsing ring for active step */}
                        {isCurrent && (
                          <span
                            className="absolute inset-0 rounded-full animate-ping"
                            style={{ backgroundColor: 'rgba(255, 102, 0, 0.2)' }}
                          />
                        )}
                        <div
                          className="relative flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-300"
                          style={
                            isCurrent
                              ? {
                                  backgroundColor: 'var(--primary-100)',
                                  border: '2px solid var(--primary-100)',
                                  color: '#ffffff',
                                  boxShadow: isSelected ? '0 0 0 3px rgba(255, 102, 0, 0.2)' : 'none',
                                }
                              : {
                                  backgroundColor: '#22c55e',
                                  border: '2px solid #22c55e',
                                  color: '#ffffff',
                                  boxShadow: isSelected ? '0 0 0 3px rgba(34, 197, 94, 0.2)' : 'none',
                                }
                          }
                        >
                          {i + 1}
                        </div>
                      </div>

                      {/* Step label */}
                      <span
                        className="text-center text-[10px] font-medium leading-tight"
                        style={{
                          color: isSelected ? 'var(--text-100)' : 'var(--accent-200)',
                        }}
                      >
                        {shortLabel(step)}
                      </span>
                    </button>

                    {/* Connector line — mt-[13px] centres on the 30px circle wrapper */}
                    {!isLast && (
                      <div
                        className="mt-[13px] h-0.5 w-4 flex-shrink-0 rounded-full transition-colors duration-500"
                        style={{
                          backgroundColor: connectorGreen ? '#22c55e' : 'var(--bg-300)',
                        }}
                      />
                    )}
                  </li>
                )
              })}
            </ol>
          </div>

          {/* Compact detail strip for selected step */}
          <div
            className="mx-5 mb-4 rounded-lg border-l-2 px-3 py-2"
            style={{
              backgroundColor: 'var(--bg-200)',
              borderLeftColor: activeIndex === lastIndex && isActive ? 'var(--primary-100)' : '#22c55e',
            }}
          >
            <p
              className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: activeIndex === lastIndex && isActive ? 'var(--primary-100)' : '#22c55e' }}
            >
              Step {Math.min(activeIndex, lastIndex) + 1} of {steps.length}
            </p>
            <p
              className="text-xs"
              style={{
                color: 'var(--text-100)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={detail}
            >
              {detail}
              {isActive && activeIndex === lastIndex && <span className="thinking-cursor" />}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
