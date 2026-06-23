import { NavLink } from 'react-router-dom'
import { ScanText, X } from 'lucide-react'
import logoUrl from '../assets/logo.png'

interface NavItem {
  to: string
  label: string
  description: string
  icon: typeof ScanText
  end?: boolean
}

const navItems: NavItem[] = [
  {
    to: '/',
    label: 'Intelligent Document Processing',
    description: 'Upload and extract structured data',
    icon: ScanText,
    end: true,
  },
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
          style={{ backgroundColor: 'rgba(17, 24, 39, 0.45)' }}
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
        {/* Brand — fixed height matches navbar so the dividers line up */}
        <div
          className="flex h-16 items-center gap-3 px-4"
          style={{ borderBottom: '1px solid var(--bg-300)' }}
        >
          <img
            src={logoUrl}
            alt="Doc Tidy"
            className="h-9 w-9 flex-shrink-0 object-contain"
          />

          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold leading-tight" style={{ color: 'var(--text-100)' }}>
              Doc Tidy
            </p>
            <p className="truncate text-xs leading-tight" style={{ color: 'var(--accent-200)' }}>
              AI Document Intelligence
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-colors lg:hidden"
            style={{ color: 'var(--accent-200)', backgroundColor: 'var(--bg-200)' }}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {/* Section header */}
          <div className="mb-2 px-2">
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: 'var(--accent-200)' }}
            >
              Services
            </span>
          </div>

          <ul className="flex flex-col gap-0.5">
            {navItems.map(item => {
              const Icon = item.icon
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    className="group relative flex items-start gap-3 rounded-xl px-3 py-2.5 transition-all duration-150"
                    style={({ isActive }) => ({
                      backgroundColor: isActive ? 'rgba(255, 102, 0, 0.08)' : 'transparent',
                      color: isActive ? 'var(--primary-100)' : 'var(--text-200)',
                      outline: isActive ? '1px solid rgba(255,102,0,0.15)' : '1px solid transparent',
                    })}
                  >
                    {({ isActive }) => (
                      <>
                        {/* Active left bar */}
                        {isActive && (
                          <span
                            className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                            style={{ backgroundColor: 'var(--primary-100)' }}
                          />
                        )}

                        {/* Icon */}
                        <div
                          className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-colors"
                          style={{
                            backgroundColor: isActive
                              ? 'rgba(255, 102, 0, 0.12)'
                              : 'var(--bg-200)',
                          }}
                        >
                          <Icon
                            className="h-4 w-4"
                            style={{ color: isActive ? 'var(--primary-100)' : 'var(--accent-200)' }}
                          />
                        </div>

                        {/* Text */}
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-sm font-semibold leading-tight"
                            style={{ color: isActive ? 'var(--primary-100)' : 'var(--text-100)' }}
                          >
                            {item.label}
                          </p>
                          <p
                            className="mt-0.5 text-[11px] leading-tight"
                            style={{ color: isActive ? 'rgba(255,102,0,0.7)' : 'var(--accent-200)' }}
                          >
                            {item.description}
                          </p>
                        </div>
                      </>
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>
    </>
  )
}
