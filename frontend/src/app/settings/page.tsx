'use client'

import { useState, useEffect, useMemo } from 'react'
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
  enabled: boolean
}

interface ConfigGroup {
  address: string
  push_type: string
  configs: PushConfig[]
}

function groupConfigs(configs: PushConfig[]): ConfigGroup[] {
  const groups = new Map<string, ConfigGroup>()
  for (const config of configs) {
    const key = `${config.push_type}:${config.address}`
    if (!groups.has(key)) {
      groups.set(key, { address: config.address, push_type: config.push_type, configs: [] })
    }
    groups.get(key)!.configs.push(config)
  }
  // Sort time points within each group (early → late)
  for (const group of groups.values()) {
    group.configs.sort((a, b) => a.push_time.localeCompare(b.push_time))
  }
  return Array.from(groups.values())
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
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ push_type: 'email', address: '', push_time: '09:00', enabled: true })
  const [addingTimeFor, setAddingTimeFor] = useState<string | null>(null)
  const [newTime, setNewTime] = useState('09:00')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const groups = useMemo(() => groupConfigs(configs), [configs])

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

  const handleAddTime = async (group: ConfigGroup) => {
    if (group.configs.length >= 3) {
      setError(t['settings.maxTimesReached'])
      return
    }
    setSaving(true)
    setError('')
    try {
      const data = await apiFetch('/push-configs', {
        method: 'POST',
        body: JSON.stringify({ push_type: group.push_type, address: group.address, push_time: newTime }),
      })
      if (data.data) {
        setConfigs(prev => [...prev, data.data])
        setAddingTimeFor(null)
        setNewTime('09:00')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number, group: ConfigGroup) => {
    // Confirm if deleting the last time point in a group
    if (group.configs.length === 1) {
      if (deleteConfirm !== id) {
        setDeleteConfirm(id)
        return
      }
    }
    try {
      await apiFetch(`/push-configs/${id}`, { method: 'DELETE' })
      setConfigs(prev => prev.filter(c => c.id !== id))
      setDeleteConfirm(null)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const toggleEnabled = async (config: PushConfig) => {
    try {
      const data = await apiFetch(`/push-configs/${config.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          push_type: config.push_type,
          address: config.address,
          push_time: config.push_time,
          enabled: !config.enabled,
        }),
      })
      if (data.data) {
        setConfigs(prev => prev.map(c => c.id === config.id ? data.data : c))
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  const startEdit = (config: PushConfig) => {
    setEditingId(config.id)
    setEditForm({
      push_type: config.push_type,
      address: config.address,
      push_time: config.push_time,
      enabled: config.enabled,
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const handleUpdate = async () => {
    if (!editForm.address.trim()) return
    setSaving(true)
    setError('')
    try {
      const data = await apiFetch(`/push-configs/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({
          push_type: editForm.push_type,
          address: editForm.address.trim(),
          push_time: editForm.push_time,
          enabled: editForm.enabled,
        }),
      })
      if (data.data) {
        setConfigs(prev => prev.map(c => c.id === editingId ? data.data : c))
        setEditingId(null)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
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

          {/* Push Configs - Grouped Cards */}
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
              {groups.length === 0 ? (
                <div className="text-center py-10">
                  <p className="font-mono text-sm mb-3" style={{ color: 'var(--text-placeholder)' }}>
                    — {t['settings.noConfigs']} —
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {t['settings.noConfigsHint']}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groups.map(group => {
                    const groupKey = `${group.push_type}:${group.address}`
                    const isAddingTime = addingTimeFor === groupKey
                    const canAddTime = group.configs.length < 3

                    return (
                      <motion.div
                        key={groupKey}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="rounded-xl border p-4"
                        style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-card)' }}
                      >
                        {/* Group Header */}
                        <div className="flex items-center gap-3 mb-3">
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border"
                            style={{
                              color: group.push_type === 'email' ? 'var(--neon-blue)' : 'var(--neon-purple)',
                              borderColor: group.push_type === 'email' ? '#3b82f620' : '#8b5cf620',
                              backgroundColor: group.push_type === 'email' ? '#3b82f605' : '#8b5cf605',
                            }}
                          >
                            {group.push_type}
                          </span>
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {group.address}
                          </span>
                          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                            {group.configs.length}/3 {t['settings.timePoint']}
                          </span>
                        </div>

                        {/* Time Points List */}
                        <div className="space-y-2">
                          {group.configs.map(config => (
                            editingId === config.id ? (
                              <motion.div
                                key={`edit-${config.id}`}
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-3 p-2 rounded-lg"
                                style={{ backgroundColor: 'var(--bg-card-hover)' }}
                              >
                                <input
                                  type="time"
                                  value={editForm.push_time}
                                  onChange={e => setEditForm(prev => ({ ...prev, push_time: e.target.value }))}
                                  className="rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 transition-all duration-200"
                                  style={{
                                    backgroundColor: 'var(--bg-card)',
                                    border: '1px solid var(--border-medium)',
                                    color: 'var(--text-primary)',
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => setEditForm(prev => ({ ...prev, enabled: !prev.enabled }))}
                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-all duration-200"
                                  style={{
                                    backgroundColor: editForm.enabled ? '#22c55e10' : 'transparent',
                                    borderColor: editForm.enabled ? '#22c55e40' : 'var(--border-medium)',
                                    color: editForm.enabled ? '#22c55e' : 'var(--text-muted)',
                                  }}
                                >
                                  <div
                                    className="w-3 h-3 rounded-full border-2 flex items-center justify-center"
                                    style={{
                                      borderColor: editForm.enabled ? '#22c55e' : 'var(--border-medium)',
                                      backgroundColor: editForm.enabled ? '#22c55e' : 'transparent',
                                    }}
                                  >
                                    {editForm.enabled && (
                                      <svg width="6" height="6" viewBox="0 0 12 12" fill="none">
                                        <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" />
                                      </svg>
                                    )}
                                  </div>
                                  {editForm.enabled ? t['settings.enabled'] : t['settings.disabled']}
                                </button>
                                <div className="flex-1" />
                                <button
                                  onClick={handleUpdate}
                                  disabled={saving}
                                  className="px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-50 transition-all duration-200"
                                  style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-primary)' }}
                                >
                                  {saving ? t['settings.saving'] : t['settings.update']}
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="px-3 py-1.5 text-xs rounded-lg border transition-all duration-200"
                                  style={{ borderColor: 'var(--border-medium)', color: 'var(--text-muted)' }}
                                >
                                  {t['settings.cancel']}
                                </button>
                              </motion.div>
                            ) : (
                              <motion.div
                                key={config.id}
                                layout
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-3 p-2 rounded-lg group/row"
                                style={{ backgroundColor: 'var(--bg-card-hover)' }}
                              >
                                <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
                                  {config.push_time}
                                </span>

                                {/* Inline toggle */}
                                <button
                                  onClick={() => toggleEnabled(config)}
                                  className="relative w-9 h-5 rounded-full transition-all duration-200"
                                  style={{
                                    backgroundColor: config.enabled ? '#22c55e' : 'var(--border-medium)',
                                  }}
                                >
                                  <motion.div
                                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
                                    animate={{ left: config.enabled ? '18px' : '2px' }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                  />
                                </button>

                                {!config.enabled && (
                                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#ef444410', color: '#ef4444' }}>
                                    {t['settings.disabled']}
                                  </span>
                                )}

                                <div className="flex-1" />

                                <div className="flex items-center gap-2 opacity-0 group-hover/row:opacity-100 transition-all duration-300">
                                  <button
                                    onClick={() => startEdit(config)}
                                    className="text-xs transition-all duration-200 hover:underline"
                                    style={{ color: 'var(--neon-blue)' }}
                                  >
                                    {t['settings.edit']}
                                  </button>
                                  <button
                                    onClick={() => handleDelete(config.id, group)}
                                    className="text-xs transition-all duration-200 hover:underline"
                                    style={{ color: deleteConfirm === config.id ? '#ef4444' : 'var(--text-muted)' }}
                                  >
                                    {deleteConfirm === config.id ? t['settings.deleteLastConfirm'] : t['settings.delete']}
                                  </button>
                                </div>
                              </motion.div>
                            )
                          ))}
                        </div>

                        {/* Add Time Button / Form */}
                        {isAddingTime ? (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-center gap-3 mt-3 pt-3"
                            style={{ borderTop: '1px solid var(--border-subtle)' }}
                          >
                            <input
                              type="time"
                              value={newTime}
                              onChange={e => setNewTime(e.target.value)}
                              className="rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 transition-all duration-200"
                              style={{
                                backgroundColor: 'var(--bg-card-hover)',
                                border: '1px solid var(--border-medium)',
                                color: 'var(--text-primary)',
                              }}
                            />
                            <button
                              onClick={() => handleAddTime(group)}
                              disabled={saving}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-50 transition-all duration-200"
                              style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-primary)' }}
                            >
                              {saving ? t['settings.saving'] : t['settings.save']}
                            </button>
                            <button
                              onClick={() => { setAddingTimeFor(null); setNewTime('09:00') }}
                              className="px-3 py-1.5 text-xs rounded-lg border transition-all duration-200"
                              style={{ borderColor: 'var(--border-medium)', color: 'var(--text-muted)' }}
                            >
                              {t['settings.cancel']}
                            </button>
                          </motion.div>
                        ) : canAddTime ? (
                          <button
                            onClick={() => setAddingTimeFor(groupKey)}
                            className="flex items-center gap-1.5 mt-3 pt-3 text-xs transition-all duration-200 hover:opacity-80"
                            style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--neon-blue)' }}
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M6 2V10M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                            {t['settings.addTime']}
                          </button>
                        ) : (
                          <p className="mt-3 pt-3 text-xs" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                            {t['settings.maxTimesReached']}
                          </p>
                        )}
                      </motion.div>
                    )
                  })}
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
