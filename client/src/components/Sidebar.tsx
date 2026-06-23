import { NavLink } from 'react-router-dom'
import { FileSearch, ScanText, X } from 'lucide-react'

interface NavItem {
  to: string
  label: string
  icon: typeof ScanText
  end?: boolean
}

const navItems: NavItem[] = [
  { to: '/', label: 'Intelligent Document Processing', icon: ScanText, end: true },
]

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ backgroundColor: 'rgba(17, 24, 39, 0.4)' }}
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          backgroundColor: 'var(--bg-100)',
          borderRight: '1px solid var(--bg-300)',
        }}
      >
        {/* Brand — py-3.5 matches navbar height so their border lines are flush */}
        <div
          className="flex items-center gap-3 px-5 py-3.5"
          style={{ borderBottom: '1px solid var(--bg-300)' }}
        >
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
            style={{
              backgroundColor: 'rgba(255, 102, 0, 0.1)',
              boxShadow: '0 0 0 1px rgba(255, 102, 0, 0.2)',
            }}
          >
            <FileSearch className="h-4 w-4" style={{ color: 'var(--primary-100)' }} />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold leading-tight" style={{ color: 'var(--text-100)' }}>
              Doc Tidy
            </p>
            <p className="truncate text-xs" style={{ color: 'var(--accent-200)' }}>
              Document intelligence
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 lg:hidden"
            style={{ color: 'var(--accent-200)' }}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p
            className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--accent-200)' }}
          >
            Workspace
          </p>
          <ul className="flex flex-col gap-1">
            {navItems.map(item => {
              const Icon = item.icon
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
                    style={({ isActive }) => ({
                      backgroundColor: isActive ? 'rgba(255, 102, 0, 0.1)' : 'transparent',
                      color: isActive ? 'var(--primary-100)' : 'var(--text-200)',
                      boxShadow: isActive ? 'inset 2px 0 0 var(--primary-100)' : 'none',
                    })}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className="h-[18px] w-[18px] flex-shrink-0"
                          style={{ color: isActive ? 'var(--primary-100)' : 'var(--accent-200)' }}
                        />
                        <span className="leading-tight">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="px-5 py-4" style={{ borderTop: '1px solid var(--bg-300)' }}>
          <p className="text-xs" style={{ color: 'var(--accent-200)' }}>
            Powered by Tidy Agent
          </p>
        </div>
      </aside>
    </>
  )
}
