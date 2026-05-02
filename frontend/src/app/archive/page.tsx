'use client'

import { useState, useEffect, useCallback } from 'react'
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

interface Task {
  id: number
  title: string
  description: string
  quadrant: string
  status: string
  due_date?: string
  created_at: string
  updated_at?: string
  ai_metadata: { reason?: string }
}

const QUADRANT_COLORS: Record<string, string> = {
  q1: '#ef4444',
  q2: '#f59e0b',
  q3: '#3b82f6',
  q4: '#8b5cf6',
}

const QUADRANT_LABELS: Record<string, string> = {
  q1: 'quadrant.q1.label',
  q2: 'quadrant.q2.label',
  q3: 'quadrant.q3.label',
  q4: 'quadrant.q4.label',
}

export default function ArchivePage() {
  const router = useRouter()
  const { t } = useLang()
  const [tasks, setTasks] = useState<Task[]>([])
  const [user, setUser] = useState<{ username: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [quadrantFilter, setQuadrantFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<'all' | 'week' | 'month'>('all')

  const fetchTasks = useCallback(async () => {
    try {
      const data = await apiFetch('/tasks?status=completed,archived')
      setTasks(data.data || [])
    } catch {
      router.push('/login')
    }
  }, [router])

  useEffect(() => {
    const u = localStorage.getItem('user')
    const tok = localStorage.getItem('token')
    if (!u || !tok) {
      router.push('/login')
      return
    }
    setUser(JSON.parse(u))
    fetchTasks().finally(() => setLoading(false))
  }, [router, fetchTasks])

  const handleRestore = async (id: number) => {
    try {
      await apiFetch(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'pending' }),
      })
      setTasks(prev => prev.filter(t => t.id !== id))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/tasks/${id}`, { method: 'DELETE' })
      setTasks(prev => prev.filter(t => t.id !== id))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  // Filter by date
  const dateFiltered = tasks.filter(task => {
    if (dateFilter === 'all') return true
    const taskDate = new Date(task.due_date || task.created_at)
    const now = new Date()
    if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return taskDate >= weekAgo
    }
    if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      return taskDate >= monthAgo
    }
    return true
  })

  // Filter by quadrant
  const filtered = dateFiltered.filter(task => {
    if (quadrantFilter === 'all') return true
    return task.quadrant === quadrantFilter
  })

  // Group tasks by quadrant (only when showing all)
  const grouped = filtered.reduce<Record<string, Task[]>>((acc, task) => {
    const q = task.quadrant || 'q4'
    if (!acc[q]) acc[q] = []
    acc[q].push(task)
    return acc
  }, {})

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
    <div className="flex flex-col h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header username={user?.username || ''} onLogout={handleLogout} />
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full overflow-y-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <h2 className="text-xl md:text-2xl font-heading font-bold" style={{ color: 'var(--text-primary)' }}>
            {t['archive.title']}
          </h2>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quadrant filter */}
            <div className="flex rounded-lg border p-0.5" style={{ borderColor: 'var(--border-medium)' }}>
              <button
                onClick={() => setQuadrantFilter('all')}
                className="px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200"
                style={{
                  backgroundColor: quadrantFilter === 'all' ? 'var(--border-medium)' : 'transparent',
                  color: quadrantFilter === 'all' ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                All
              </button>
              {['q1', 'q2', 'q3', 'q4'].map(q => (
                <button
                  key={q}
                  onClick={() => setQuadrantFilter(q)}
                  className="px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200"
                  style={{
                    backgroundColor: quadrantFilter === q ? QUADRANT_COLORS[q] + '20' : 'transparent',
                    color: quadrantFilter === q ? QUADRANT_COLORS[q] : 'var(--text-muted)',
                  }}
                >
                  {q.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Date filter */}
            <div className="flex rounded-lg border p-0.5" style={{ borderColor: 'var(--border-medium)' }}>
              {(['all', 'week', 'month'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDateFilter(d)}
                  className="px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200"
                  style={{
                    backgroundColor: dateFilter === d ? 'var(--border-medium)' : 'transparent',
                    color: dateFilter === d ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  {d === 'all' ? t['dashboard.allDays'] : d === 'week' ? t['task.dueDate.thisWeek'] : t['task.dueDate.nextMonth']}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 rounded-xl mb-4 text-sm"
              style={{ backgroundColor: '#ef444410', border: '1px solid #ef444430', color: '#ef4444' }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
              {t['archive.empty']}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {['q1', 'q2', 'q3', 'q4'].map(q => {
              const qTasks = grouped[q]
              if (!qTasks || qTasks.length === 0) return null
              return (
                <motion.div
                  key={q}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-sm p-4"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <span
                      className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border"
                      style={{
                        color: QUADRANT_COLORS[q],
                        borderColor: QUADRANT_COLORS[q] + '33',
                        backgroundColor: QUADRANT_COLORS[q] + '10',
                      }}
                    >
                      {t[QUADRANT_LABELS[q]]}
                    </span>
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      {qTasks.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {qTasks.map(task => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-3 rounded-xl border group"
                        style={{
                          backgroundColor: 'var(--bg-card-hover)',
                          borderColor: 'var(--border-subtle)',
                        }}
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <h4 className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {task.title}
                          </h4>
                          <div className="flex items-center gap-3 mt-1">
                            {task.due_date && (
                              <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                                {task.due_date}
                              </span>
                            )}
                            {task.updated_at && (
                              <span className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                                {t['archive.archivedOn']} {task.updated_at.split('T')[0]}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleRestore(task.id)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-200 hover:opacity-80"
                            style={{
                              borderColor: 'var(--border-medium)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {t['archive.restore']}
                          </button>
                          <button
                            onClick={() => handleDelete(task.id)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-200 hover:opacity-80"
                            style={{
                              borderColor: '#ef444430',
                              color: '#ef4444',
                            }}
                          >
                            {t['settings.delete']}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
