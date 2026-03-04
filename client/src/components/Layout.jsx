import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '◆' },
  { to: '/concerts', label: 'Concerts', icon: '♫' },
  { to: '/upcoming', label: 'Upcoming', icon: '▶' },
  { to: '/wishlist', label: 'Wishlist', icon: '★' },
  { to: '/map', label: 'Map', icon: '◎' },
  { to: '/artists', label: 'Artists', icon: '♪' },
  { to: '/collection', label: 'Collection', icon: '🎫' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Ambient glows */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] rounded-full blur-[150px] pointer-events-none opacity-20"
        style={{ background: 'radial-gradient(circle, #ff3c64 0%, transparent 70%)' }} />
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-[150px] pointer-events-none opacity-15"
        style={{ background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)' }} />

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-bg/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <NavLink to="/" className="flex items-center gap-2 no-underline">
              <span className="text-2xl font-bold font-heading text-accent tracking-tight">GigLog</span>
            </NavLink>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-lg text-sm font-medium transition-colors no-underline ${
                      isActive
                        ? 'text-accent bg-accent/10'
                        : 'text-text-muted hover:text-text hover:bg-white/5'
                    }`
                  }
                >
                  <span className="mr-1.5">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* Mobile menu button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 text-text-muted hover:text-text rounded-lg hover:bg-white/5 border-0 bg-transparent cursor-pointer"
            >
              <span className="text-xl">{menuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <nav className="md:hidden border-t border-border bg-bg/95 backdrop-blur-xl">
            <div className="px-4 py-2 space-y-1">
              {navItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors no-underline ${
                      isActive
                        ? 'text-accent bg-accent/10'
                        : 'text-text-muted hover:text-text hover:bg-white/5'
                    }`
                  }
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-sm text-text-muted relative z-10">
        <p>
          Setlist data powered by{' '}
          <a href="https://www.setlist.fm" target="_blank" rel="noopener noreferrer" className="text-secondary hover:text-secondary-hover underline">
            setlist.fm
          </a>
        </p>
      </footer>
    </div>
  )
}
