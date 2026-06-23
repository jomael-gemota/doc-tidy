import { useEffect, useRef } from 'react'
import { Brain, Check } from 'lucide-react'

interface ThinkingStreamProps {
  content: string
  isActive: boolean
}

function parseSteps(content: string): string[] {
  return content
    .split(/\n\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

export default function ThinkingStream({ content, isActive }: ThinkingStreamProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [content])

  const steps = parseSteps(content)
  const hasContent = steps.length > 0

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-100)' }}>
      {/* Panel header */}
      <div
        className="flex items-center gap-2.5 px-5 py-3.5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--bg-300)' }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: isActive ? 'rgba(255, 102, 0, 0.1)' : hasContent ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-200)',
          }}
        >
          <Brain
            className="w-4 h-4"
            style={{ color: isActive ? 'var(--primary-100)' : hasContent ? '#22c55e' : 'var(--accent-200)' }}
          />
        </div>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>
          Tidy Agent Processing
        </span>
        {isActive && (
          <span
            className="ml-auto flex items-center gap-1.5 text-xs font-medium"
            style={{ color: 'var(--primary-100)' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: 'var(--primary-100)' }}
            />
            Thinking…
          </span>
        )}
        {!isActive && hasContent && (
          <span
            className="ml-auto flex items-center gap-1.5 text-xs font-medium"
            style={{ color: '#22c55e' }}
          >
            <Check className="w-3.5 h-3.5" />
            Done
          </span>
        )}
      </div>

      {/* Stepper content */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {!hasContent ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--bg-200)' }}
            >
              <Brain className="w-5 h-5" style={{ color: 'var(--bg-300)' }} />
            </div>
            <p className="text-sm text-center" style={{ color: 'var(--accent-200)' }}>
              Agent reasoning will appear here once processing begins…
            </p>
          </div>
        ) : (
          <ol className="flex flex-col">
            {steps.map((step, i) => {
              const isLastStep = i === steps.length - 1
              const isCurrentStep = isLastStep && isActive
              const isDoneStep = !isCurrentStep

              return (
                <li
                  key={i}
                  className="flex gap-3.5 stepper-step"
                  style={{ animationDelay: `${Math.min(i * 40, 200)}ms` }}
                >
                  {/* Left rail: circle + connector line */}
                  <div className="flex flex-col items-center flex-shrink-0" style={{ width: '28px' }}>
                    {/* Step indicator circle */}
                    <div className="relative flex items-center justify-center flex-shrink-0">
                      {/* Pulsing ring for active step */}
                      {isCurrentStep && (
                        <span
                          className="absolute rounded-full animate-ping"
                          style={{
                            width: '34px',
                            height: '34px',
                            backgroundColor: 'rgba(255, 102, 0, 0.15)',
                          }}
                        />
                      )}
                      <div
                        className="relative w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all duration-300"
                        style={
                          isCurrentStep
                            ? {
                                backgroundColor: 'var(--primary-100)',
                                border: '2px solid var(--primary-100)',
                                color: '#ffffff',
                              }
                            : {
                                backgroundColor: '#22c55e',
                                border: '2px solid #22c55e',
                                color: '#ffffff',
                              }
                        }
                      >
                        {i + 1}
                      </div>
                    </div>

                    {/* Vertical connector line (not after last step) */}
                    {!isLastStep && (
                      <div
                        className="flex-1 my-1.5 transition-colors duration-500"
                        style={{
                          width: '2px',
                          minHeight: '16px',
                          backgroundColor: isDoneStep ? '#22c55e' : 'var(--bg-300)',
                          borderRadius: '1px',
                          opacity: isDoneStep ? 0.6 : 1,
                        }}
                      />
                    )}
                  </div>

                  {/* Right: step content */}
                  <div
                    className="flex-1 pb-5 text-sm leading-relaxed"
                    style={{
                      color: isCurrentStep ? 'var(--text-200)' : 'var(--text-100)',
                      paddingTop: '3px',
                    }}
                  >
                    <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {step}
                    </span>
                    {isCurrentStep && <span className="thinking-cursor" />}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}
