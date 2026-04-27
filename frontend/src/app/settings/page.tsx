'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Header from '@/components/Header'
import { useLang } from '@/i18n/LanguageContext'

const API = process.env.NEXT_PUBLIC_API_URL || '/api'

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token')
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (res.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || data.message || `Error: ${res.status}`)
  }
  return res.json()
}

interface PushConfig {
  id: number
  push_type: string
  address: string
  push_time: string
}

export default function SettingsPage() {
  const router = useRouter()
  const { t } = useLang()
  const [user, setUser] = useState<{ username: string } | null>(null)
  const [configs, setConfigs] = useState<PushConfig[]>([])
  const [pushType, setPushType] = useState('email')
  const [address, setAddress] = useState('')
  const [pushTime, setPushTime] = useState('09:00')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const u = localStorage.getItem('user')
    const tok = localStorage.getItem('token')
    if (!u || !tok) {
      router.push('/login')
      return
    }
    setUser(JSON.parse(u))
    fetchConfigs()
  }, [router])

  const fetchConfigs = async () => {
    try {
      const data = await apiFetch('/push-configs')
      setConfigs(data.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address.trim()) return
    setSaving(true)
    setError('')
    try {
      const data = await apiFetch('/push-configs', {
        method: 'POST',
        body: JSON.stringify({ push_type: pushType, address: address.trim(), push_time: pushTime }),
      })
      if (data.data) {
        setConfigs(prev => [...prev, data.data])
        setAddress('')
        setPushType('email')
        setPushTime('09:00')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/push-configs/${id}`, { method: 'DELETE' })
      setConfigs(prev => prev.filter(c => c.id !== id))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--neon-blue)' }} />
          <span className="text-sm font-mono">{t['dashboard.loading']}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header username={user?.username || ''} onLogout={handleLogout} />
      <main className="flex-1 p-4 md:p-6 max-w-3xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-xl md:text-2xl font-heading font-bold mb-8" style={{ color: 'var(--text-primary)' }}>
            {t['settings.title']}
          </h2>

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

          {/* Push Configs List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="glass p-6 mb-6"
          >
            <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              {t['settings.pushConfigs']}
            </h3>

            <AnimatePresence mode="popLayout">
              {configs.length === 0 ? (
                <p className="text-center py-10 font-mono text-sm" style={{ color: 'var(--text-placeholder)' }}>
                  — {t['settings.noConfigs']} —
                </p>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {configs.map(config => (
                    <motion.div
                      key={config.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex items-center justify-between py-3 group"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border"
                          style={{
                            color: config.push_type === 'email' ? 'var(--neon-blue)' : 'var(--neon-purple)',
                            borderColor: config.push_type === 'email' ? '#3b82f620' : '#8b5cf620',
                            backgroundColor: config.push_type === 'email' ? '#3b82f605' : '#8b5cf605',
                          }}
                        >
                          {config.push_type}
                        </span>
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{config.address}</span>
                        {config.push_time && (
                          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{config.push_time}</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(config.id)}
                        className="opacity-0 group-hover:opacity-100 text-xs transition-all duration-300"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {t['settings.delete']}
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Add Push Config Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="glass p-6"
          >
            <h3 className="text-sm font-semibold mb-6 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              {t['settings.addConfig']}
            </h3>

            <form onSubmit={handleAdd} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                  {t['settings.type']}
                </label>
                <div className="flex gap-3">
                  {['email', 'webhook'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setPushType(type)}
                      className="px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-300"
                      style={{
                        backgroundColor: pushType === type ? 'var(--border-medium)' : 'transparent',
                        borderColor: pushType === type ? 'var(--border-medium)' : 'var(--border-medium)',
                        color: pushType === type ? 'var(--text-primary)' : 'var(--text-muted)',
                      }}
                    >
                      {type === 'email' ? '📧 Email' : '🔗 Webhook'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                  {t['settings.address']}
                </label>
                <input
                  type={pushType === 'email' ? 'email' : 'url'}
                  placeholder={pushType === 'email' ? 'your@email.com' : 'https://hooks.example.com/...'}
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all duration-300"
                  style={{
                    backgroundColor: 'var(--bg-card-hover)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                  }}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                  {t['settings.pushTime']}
                </label>
                <input
                  type="time"
                  value={pushTime}
                  onChange={e => setPushTime(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all duration-300"
                  style={{
                    backgroundColor: 'var(--bg-card-hover)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 text-sm font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:shadow-md"
                style={{
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--bg-primary)',
                }}
              >
                {saving ? t['settings.saving'] : t['settings.save']}
              </button>
            </form>
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}
