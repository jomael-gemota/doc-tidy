import { Menu, Bot, CheckCircle2, CircleSlash, WifiOff } from 'lucide-react'
import { useHealth } from '../hooks/useHealth'

interface NavbarProps {
  title: string
  subtitle?: string
  onMenuClick: () => void
}

export default function Navbar({ title, subtitle, onMenuClick }: NavbarProps) {
  const { reachable, workerConnected } = useHealth()

  const online = reachable && workerConnected
  const status = online
    ? { color: '#22c55e', label: 'Online', Icon: CheckCircle2 }
    : reachable
      ? { color: 'var(--primary-100)', label: 'Offline', Icon: CircleSlash }
      : { color: '#ef4444', label: 'Disconnected', Icon: WifiOff }
  const StatusIcon = status.Icon

  return (
    <header
      className="sticky top-0 z-20 flex h-16 items-center gap-3 px-4 backdrop-blur-sm sm:px-6"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        borderBottom: '1px solid var(--bg-300)',
      }}
    >
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-lg p-1.5 lg:hidden"
        style={{ color: 'var(--text-200)' }}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold leading-tight" style={{ color: 'var(--text-100)' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="truncate text-xs" style={{ color: 'var(--accent-200)' }}>
            {subtitle}
          </p>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div
          className="inline-flex items-center gap-2 rounded-full border py-1.5 pl-2 pr-3"
          style={{
            backgroundColor: 'var(--bg-100)',
            borderColor: 'var(--bg-300)',
          }}
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--bg-200)' }}
          >
            <Bot className="h-3.5 w-3.5" style={{ color: 'var(--text-200)' }} />
          </span>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-200)' }}>
            Tidy Agent
          </span>
          <span className="h-3.5 w-px" style={{ backgroundColor: 'var(--bg-300)' }} />
          <span className="inline-flex items-center gap-1" style={{ color: status.color }}>
            <StatusIcon className={`h-3.5 w-3.5 ${online ? '' : 'animate-pulse'}`} />
            <span className="text-xs font-medium">{status.label}</span>
          </span>
        </div>
      </div>
    </header>
  )
}
