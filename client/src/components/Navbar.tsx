import { Menu } from 'lucide-react'
import { useHealth } from '../hooks/useHealth'

interface NavbarProps {
  title: string
  subtitle?: string
  onMenuClick: () => void
}

export default function Navbar({ title, subtitle, onMenuClick }: NavbarProps) {
  const { reachable, workerConnected } = useHealth()

  const online = reachable && workerConnected
  const statusColor = online ? '#22c55e' : reachable ? 'var(--primary-100)' : '#ef4444'
  const statusLabel = online ? 'Worker online' : reachable ? 'Worker offline' : 'Disconnected'

  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3.5 backdrop-blur-sm sm:px-6"
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
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
          style={{
            backgroundColor: 'var(--bg-100)',
            borderColor: 'var(--bg-300)',
          }}
        >
          <span
            className={`h-2 w-2 rounded-full ${online ? '' : 'animate-pulse'}`}
            style={{ backgroundColor: statusColor }}
          />
          <span className="text-xs font-medium" style={{ color: 'var(--text-200)' }}>
            {statusLabel}
          </span>
        </div>
      </div>
    </header>
  )
}
