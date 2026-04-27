'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { useLang } from '@/i18n/LanguageContext'
import ThemeToggle from './ThemeToggle'

const navLinks = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: '⊞' },
  { href: '/stats', labelKey: 'nav.stats', icon: '⊡' },
  { href: '/settings', labelKey: 'nav.settings', icon: '⊘' },
]

export default function Header({ username, onLogout }: { username: string; onLogout: () => void }) {
  const pathname = usePathname()
  const { lang, setLang, t } = useLang()

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-xl"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
        {/* Left: logo + nav */}
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-heading font-bold gradient-text hover:opacity-80 transition-opacity">
            ishwe
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map(link => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="relative px-3 py-1.5 text-sm rounded-lg transition-all duration-300"
                  style={{
                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    backgroundColor: isActive ? 'var(--border-medium)' : 'transparent',
                  }}
                >
                  <span className="mr-1.5 opacity-60">{link.icon}</span>
                  {t[link.labelKey]}
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 rounded-lg"
                      style={{ backgroundColor: 'var(--border-medium)' }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          {/* Language switch */}
          <button
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            className="text-xs px-2.5 py-1.5 rounded-lg border transition-all duration-300"
            style={{
              borderColor: 'var(--border-medium)',
              color: 'var(--text-muted)',
            }}
          >
            {t['lang.switch']}
          </button>

          <span className="text-sm hidden sm:inline" style={{ color: 'var(--text-muted)' }}>
            {username}
          </span>

          {/* GitHub */}
          <a
            href="https://github.com/Pronting/eisenhower"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors duration-300 p-1"
            style={{ color: 'var(--text-muted)' }}
            aria-label="GitHub"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </a>

          <button
            onClick={onLogout}
            className="text-sm transition-colors duration-300"
            style={{ color: 'var(--text-muted)' }}
          >
            {t['header.logout']}
          </button>
        </div>
      </div>
    </header>
  )
}
