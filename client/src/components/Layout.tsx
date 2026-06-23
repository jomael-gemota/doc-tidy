import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

function getPageMeta(pathname: string): { title: string; subtitle: string } {
  if (pathname.startsWith('/jobs/')) {
    return {
      title: 'Batch Workspace',
      subtitle: 'Review Tidy reasoning and the final structured output',
    }
  }
  return {
    title: 'Intelligent Document Processing',
    subtitle: 'Upload PDFs and let Tidy extract structured data',
  }
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const meta = getPageMeta(location.pathname)

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-200)' }}>
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar
          title={meta.title}
          subtitle={meta.subtitle}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
