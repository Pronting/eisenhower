'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useLang } from '@/i18n/LanguageContext'
import ThemeToggle from '@/components/ThemeToggle'

const API = process.env.NEXT_PUBLIC_API_URL || '/api'

export default function RegisterPage() {
  const router = useRouter()
  const { t } = useLang()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password !== confirmPassword) {
      setError(t['register.passwordsNotMatch'])
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.message || 'Registration failed')
      localStorage.setItem('token', data.data.token)
      localStorage.setItem('user', JSON.stringify(data.data.user))
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="fixed inset-0 bg-grid-animated pointer-events-none" style={{ opacity: 0.3 }} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t['register.backHome']}
          </Link>
          <ThemeToggle />
        </div>

        <div className="glass p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-heading font-bold gradient-text mb-2">
              ishwe
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t['register.title']}</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl mb-6 text-sm"
              style={{ backgroundColor: '#ef444410', border: '1px solid #ef444420', color: '#ef4444' }}
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {t['register.username']}
              </label>
              <input
                type="text"
                placeholder="your_username"
                required
                maxLength={50}
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all duration-300"
                style={{
                  backgroundColor: 'var(--bg-card-hover)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                }}
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {t['register.email']}
              </label>
              <input
                type="email"
                placeholder="your@email.com"
                required
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all duration-300"
                style={{
                  backgroundColor: 'var(--bg-card-hover)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                }}
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {t['register.password']}
              </label>
              <input
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all duration-300"
                style={{
                  backgroundColor: 'var(--bg-card-hover)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                }}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {t['register.confirmPassword']}
              </label>
              <input
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all duration-300"
                style={{
                  backgroundColor: 'var(--bg-card-hover)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                }}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="relative w-full py-3 font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:shadow-md"
              style={{
                backgroundColor: 'var(--text-primary)',
                color: 'var(--bg-primary)',
              }}
            >
              {loading ? t['register.loading'] : t['register.button']}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
            {t['register.hasAccount']}{' '}
            <Link href="/login" style={{ color: 'var(--neon-blue)' }}>
              {t['register.login']}
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
