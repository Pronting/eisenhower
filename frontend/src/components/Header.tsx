'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { useLang } from '@/i18n/LanguageContext'
import ThemeToggle from './ThemeToggle'

const navLinks = [
  { href: '/dashboard', labelKey: 'nav.dashboard', iconPath: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z' },
  { href: '/archive', labelKey: 'nav.archive', iconPath: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z' },
  { href: '/settings', labelKey: 'nav.settings', iconPath: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28zM12 15a3 3 0 100-6 3 3 0 000 6z' },
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
                    color: isActive ? 'var(--neon-blue)' : 'var(--text-muted)',
                    backgroundColor: isActive ? 'color-mix(in srgb, var(--neon-blue) 12%, transparent)' : 'transparent',
                  }}
                >
                  <svg className="mr-1.5 inline-block" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: isActive ? 1 : 0.5 }}><path d={link.iconPath} /></svg>
                  {t[link.labelKey]}
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
