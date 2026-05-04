'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import Header from '@/components/Header'
import QuadrantBoard from '@/components/QuadrantBoard'
import StatsSection from '@/components/StatsSection'
import { useLang } from '@/i18n/LanguageContext'

const Mascot = dynamic(() => import('@/components/Mascot'), { ssr: false })

interface Task {
  id: number
  title: string
  description: string
  quadrant: string
  status: string
  due_date?: string
  created_at: string
  ai_metadata: { reason?: string }
}

const API = process.env.NEXT_PUBLIC_API_URL || '/api'

function todayStr(): string {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

function dateAdd(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

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
    throw new Error(data.detail || data.message || `Request failed: ${res.status}`)
  }
  return res.json()
}

// Map urgent/important to quadrant
function mapToQuadrant(urgent: boolean, important: boolean): string {
  if (important && urgent) return 'q1'
  if (important && !urgent) return 'q2'
  if (!important && urgent) return 'q3'
  return 'q4'
}

export default function DashboardPage() {
  const router = useRouter()
  const { t } = useLang()
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isUrgent, setIsUrgent] = useState(false)
  const [isImportant, setIsImportant] = useState(false)
  const [userToggledPriority, setUserToggledPriority] = useState(false)
  const [dueDate, setDueDate] = useState('')
  const [user, setUser] = useState<{ username: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Quick Note state
  const [noteContent, setNoteContent] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [noteConfirming, setNoteConfirming] = useState(false)
  const [noteError, setNoteError] = useState('')

  // Date filter — default to today
  const [dateFilter, setDateFilter] = useState<'today' | 'all'>('today')
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const mainRef = useRef<HTMLDivElement>(null)
  const noteFormRef = useRef<HTMLDivElement>(null)
  const newFormRef = useRef<HTMLFormElement>(null)

  const fetchTasks = useCallback(async () => {
    try {
      let path = '/tasks?status=pending'
      if (dateFilter === 'today') {
        path += `&due_date=${selectedDate}`
      }
      const data = await apiFetch(path)
      setTasks(data.data || [])
    } catch {
      router.push('/login')
    }
  }, [router, dateFilter, selectedDate])

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

  // Scroll to form when it opens
  useEffect(() => {
    if (showNote) {
      requestAnimationFrame(() => noteFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
    }
  }, [showNote])

  useEffect(() => {
    if (showForm) {
      requestAnimationFrame(() => newFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
    }
  }, [showForm])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    setError('')
    try {
      const body: Record<string, any> = { title: title.trim(), description }
      // Send quadrant: user-selected or default to q4
      body.quadrant = userToggledPriority ? mapToQuadrant(isUrgent, isImportant) : 'q4'
      body.due_date = dueDate || todayStr()
      const data = await apiFetch('/tasks', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (data.data) {
        setTasks(prev => [data.data, ...prev])
        setTitle('')
        setDescription('')
        setIsUrgent(false)
        setIsImportant(false)
        setUserToggledPriority(false)
        setDueDate('')
        setShowForm(false)
        setSuccessMsg('✓ ' + t['dashboard.confirmAdd'])
        // Wait for React to re-render before scrolling
        requestAnimationFrame(() => {
          mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
        })
        setTimeout(() => setSuccessMsg(''), 2000)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
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

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await apiFetch(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      // Completed tasks are auto-archived by backend, remove from list
      if (status === 'completed') {
        setTasks(prev => prev.filter(t => t.id !== id))
      } else {
        setTasks(prev => prev.map(t => (t.id === id ? { ...t, status } : t)))
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDateChange = async (id: number, dueDate: string) => {
    try {
      await apiFetch(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ due_date: dueDate || null }),
      })
      setTasks(prev => prev.map(t => (t.id === id ? { ...t, due_date: dueDate || undefined } : t)))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleQuadrantChange = async (id: number, quadrant: string) => {
    // Optimistic update
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, quadrant } : t)))
    try {
      await apiFetch(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ quadrant }),
      })
    } catch (err: any) {
      // Revert on error — refetch
      fetchTasks()
      setError(err.message)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  // Quick Note handlers
  const handleNoteConfirm = async () => {
    if (!noteContent.trim()) return
    setNoteConfirming(true)
    setNoteError('')
    try {
      // Step 1: AI analysis
      console.log('[QuickNote] Sending content:', noteContent.trim().substring(0, 50))
      const processData = await apiFetch('/notes/process', {
        method: 'POST',
        body: JSON.stringify({ content: noteContent.trim() }),
      })
      console.log('[QuickNote] Response:', processData)
      // Check for backend-level error
      if (processData.message && processData.message !== 'ok') {
        setNoteError(processData.message)
        setNoteConfirming(false)
        return
      }
      const noteTasks = processData.data?.tasks || []
      console.log('[QuickNote] Tasks found:', noteTasks.length)
      if (noteTasks.length === 0) {
        // Show more specific error — could be AI issue or genuinely no tasks
        const detail = processData.data?.error || processData.data?.detail
        setNoteError(detail || t['dashboard.quickNote.empty'])
        setNoteConfirming(false)
        return
      }
      // Step 2: Auto-confirm and save
      const confirmData = await apiFetch('/notes/confirm', {
        method: 'POST',
        body: JSON.stringify({
          content: noteContent.trim(),
          tasks: noteTasks,
        }),
      })
      if (confirmData.data) {
        const newTasks = confirmData.data.tasks || []
        setTasks(prev => [...newTasks, ...prev])
        setNoteContent('')

        setShowNote(false)
        requestAnimationFrame(() => {
          mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
        })
      }
    } catch (err: any) {
      setNoteError(err.message)
    } finally {
      setNoteConfirming(false)
    }
  }

  const handleNoteClear = () => {
    setNoteContent('')
    // note tasks cleared
    setNoteError('')
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

  const completedCount = tasks.filter(t => t.status === 'completed').length

  return (
    <div className="flex flex-col h-screen relative" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Animated gradient background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute -top-1/2 -left-1/4 w-[150%] h-[150%] rounded-full opacity-[0.06]"
          style={{
            background: 'radial-gradient(circle at 50% 40%, var(--neon-blue) 0%, transparent 50%)',
            animation: 'bgPulse1 12s ease-in-out infinite',
          }}
        />
        <div
          className="absolute -bottom-1/2 -right-1/4 w-[150%] h-[150%] rounded-full opacity-[0.05]"
          style={{
            background: 'radial-gradient(circle at 40% 60%, var(--neon-purple) 0%, transparent 50%)',
            animation: 'bgPulse2 15s ease-in-out infinite',
          }}
        />
        <div
          className="absolute top-0 left-1/3 w-[120%] h-[120%] rounded-full opacity-[0.04]"
          style={{
            background: 'radial-gradient(circle at 60% 50%, var(--neon-amber) 0%, transparent 50%)',
            animation: 'bgPulse3 18s ease-in-out infinite',
          }}
        />
      </div>
      <Header username={user?.username || ''} onLogout={handleLogout} />
      <main ref={mainRef} className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full flex flex-col overflow-y-auto">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <div>
            <h2 className="text-xl md:text-2xl font-heading font-bold" style={{ color: 'var(--text-primary)' }}>
              {t['dashboard.title']}
            </h2>
            <p className="text-xs mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>
              {t['dashboard.taskCount'].replace('{count}', String(tasks.length))} · {t['dashboard.completedCount'].replace('{count}', String(completedCount))}
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* Date filter toggle */}
            <div className="flex rounded-lg border p-0.5" style={{ borderColor: 'var(--border-medium)' }}>
              <button
                onClick={() => setDateFilter('today')}
                className="px-2 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200"
                style={{
                  backgroundColor: dateFilter === 'today' ? 'var(--border-medium)' : 'transparent',
                  color: dateFilter === 'today' ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                {t['dashboard.today']}
              </button>
              <button
                onClick={() => setDateFilter('all')}
                className="px-2 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200"
                style={{
                  backgroundColor: dateFilter === 'all' ? 'var(--border-medium)' : 'transparent',
                  color: dateFilter === 'all' ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                {t['dashboard.allDays']}
              </button>
            </div>

            {/* Date picker */}
            {dateFilter === 'today' && (
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-2 sm:px-3 py-1.5 text-xs rounded-lg border w-[130px] sm:w-auto"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border-medium)',
                  color: 'var(--text-primary)',
                }}
              />
            )}

            <button
              onClick={() => {
                setShowNote(!showNote)
                if (showForm) setShowForm(false)
              }}
              title={t['tooltip.quickNote']}
              className="relative group px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-300 hover:shadow-md"
              style={{
                backgroundColor: showNote ? 'var(--neon-blue)' : 'var(--bg-card)',
                color: showNote ? '#fff' : 'var(--text-primary)',
                border: '1px solid var(--border-medium)',
              }}
            >
              📝 {t['dashboard.quickNote']}
            </button>

            <button
              onClick={() => {
                setShowForm(!showForm)
                if (showNote) setShowNote(false)
              }}
              title={t['tooltip.newTask']}
              className="relative group px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-300 hover:shadow-md"
              style={{
                backgroundColor: 'var(--text-primary)',
                color: 'var(--bg-primary)',
              }}
            >
              {showForm ? '✕ ' : ''}{t['dashboard.newTask']}
            </button>
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="p-3 rounded-xl mb-4 text-sm"
              style={{
                backgroundColor: '#ef444410',
                borderColor: '#ef444430',
                border: '1px solid #ef444430',
                color: '#ef4444',
              }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success toast — fixed position */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[calc(100%-2rem)] p-3 rounded-xl text-sm font-medium shadow-lg"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid #22c55e40',
                color: '#22c55e',
              }}
            >
              {successMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Note form */}
        <AnimatePresence>
          {showNote && (
            <motion.div
              ref={noteFormRef}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-sm p-4 mb-4"
            >
              {/* Note input */}
              <textarea
                placeholder={t['dashboard.quickNote.placeholder']}
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all duration-300 resize-none mb-3"
                rows={5}
                style={{
                  backgroundColor: 'var(--bg-card-hover)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                }}
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                autoFocus
              />

              {/* Note error */}
              {noteError && (
                <div className="text-xs mb-3 px-3 py-2 rounded-lg" style={{
                  backgroundColor: '#ef444410',
                  color: '#ef4444',
                  border: '1px solid #ef444430',
                }}>
                  {noteError}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleNoteClear}
                  className="px-4 py-2 text-sm transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {t['dashboard.quickNote.clear']}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNote(false)}
                  className="px-4 py-2 text-sm transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {t['dashboard.cancel']}
                </button>
                <button
                  type="button"
                  onClick={handleNoteConfirm}
                  disabled={noteConfirming || !noteContent.trim()}
                  className="px-6 py-2.5 text-sm font-bold rounded-xl disabled:opacity-50 transition-all duration-300 hover:shadow-lg"
                  style={{
                    backgroundColor: 'var(--text-primary)',
                    color: 'var(--bg-primary)',
                  }}
                >
                  {noteConfirming ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      {t['dashboard.quickNote.confirming']}
                    </span>
                  ) : (
                    t['dashboard.quickNote.confirm']
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* New task form */}
        <AnimatePresence>
          {showForm && (
            <motion.form
              ref={newFormRef}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={handleCreate}
              className="glass-sm p-4 mb-4"
            >
              <input
                type="text"
                placeholder={t['dashboard.whatToDo']}
                required
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all duration-300 mb-3"
                style={{
                  backgroundColor: 'var(--bg-card-hover)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                }}
                value={title}
                onChange={e => setTitle(e.target.value)}
                autoFocus
              />
              <textarea
                placeholder={t['dashboard.description']}
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all duration-300 resize-none mb-3"
                rows={2}
                style={{
                  backgroundColor: 'var(--bg-card-hover)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                }}
                value={description}
                onChange={e => setDescription(e.target.value)}
              />

              {/* Urgent / Important toggles */}
              <div className="flex gap-4 mb-3">
                <button
                  type="button"
                  onClick={() => { setIsUrgent(!isUrgent); setUserToggledPriority(true) }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all duration-200 ${
                    isUrgent ? 'shadow-md' : ''
                  }`}
                  style={{
                    backgroundColor: isUrgent ? '#ef444415' : 'transparent',
                    borderColor: isUrgent ? '#ef4444' : 'var(--border-medium)',
                    color: isUrgent ? '#ef4444' : 'var(--text-muted)',
                  }}
                >
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${isUrgent ? 'border-ef4444 bg-ef4444' : ''}`}
                    style={{ borderColor: isUrgent ? '#ef4444' : 'var(--border-medium)' }}>
                    {isUrgent && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  ⚡ {t['task.urgent']}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsImportant(!isImportant); setUserToggledPriority(true) }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all duration-200 ${
                    isImportant ? 'shadow-md' : ''
                  }`}
                  style={{
                    backgroundColor: isImportant ? '#f59e0b15' : 'transparent',
                    borderColor: isImportant ? '#f59e0b' : 'var(--border-medium)',
                    color: isImportant ? '#f59e0b' : 'var(--text-muted)',
                  }}
                >
                  <span className="w-4 h-4 rounded border-2 flex items-center justify-center"
                    style={{ borderColor: isImportant ? '#f59e0b' : 'var(--border-medium)' }}>
                    {isImportant && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  🎯 {t['task.important']}
                </button>
              </div>

              {/* Due date presets */}
              <div className="mb-3">
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                  {t['task.dueDate']}
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'task.dueDate.today', value: todayStr() },
                    { key: 'task.dueDate.tomorrow', value: dateAdd(1) },
                    { key: 'task.dueDate.thisWeek', value: dateAdd(7) },
                    { key: 'task.dueDate.nextMonth', value: dateAdd(30) },
                    { key: 'task.dueDate.nextHalfYear', value: dateAdd(180) },
                    { key: 'task.dueDate.noDue', value: '' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setDueDate(opt.value)}
                      className="px-3 py-1.5 text-xs rounded-lg border transition-all duration-200"
                      style={{
                        backgroundColor: dueDate === opt.value ? 'var(--border-medium)' : 'transparent',
                        borderColor: dueDate === opt.value ? 'var(--neon-blue)' : 'var(--border-medium)',
                        color: dueDate === opt.value ? 'var(--text-primary)' : 'var(--text-muted)',
                      }}
                    >
                      {t[opt.key]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quadrant preview */}
              <div className="mb-4 p-3 rounded-xl" style={{ backgroundColor: 'var(--border-subtle)', border: '1px solid var(--border-medium)' }}>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                  {t['dashboard.previewQuadrant']}
                </p>
                {isUrgent && isImportant && (
                  <div className="text-sm font-semibold" style={{ color: '#ef4444' }}>
                    ⚡ Q1: {t['quadrant.q1.label']} — {t['quadrant.q1.desc']}
                  </div>
                )}
                {isImportant && !isUrgent && (
                  <div className="text-sm font-semibold" style={{ color: '#f59e0b' }}>
                    🎯 Q2: {t['quadrant.q2.label']} — {t['quadrant.q2.desc']}
                  </div>
                )}
                {isUrgent && !isImportant && (
                  <div className="text-sm font-semibold" style={{ color: '#3b82f6' }}>
                    📤 Q3: {t['quadrant.q3.label']} — {t['quadrant.q3.desc']}
                  </div>
                )}
                {!isUrgent && !isImportant && (
                  <div className="text-sm font-semibold" style={{ color: '#8b5cf6' }}>
                    🗑 Q4: {t['quadrant.q4.label']} — {t['quadrant.q4.desc']}
                  </div>
                )}
                {title.trim() && (
                  <p className="text-xs mt-2 truncate" style={{ color: 'var(--text-secondary)' }}>
                    「{title.trim()}」
                    {dueDate && <span className="ml-2">· {dueDate}</span>}
                  </p>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {t['dashboard.cancel']}
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2.5 text-sm font-bold rounded-xl disabled:opacity-50 transition-all duration-300 hover:shadow-lg"
                  style={{
                    backgroundColor: 'var(--text-primary)',
                    color: 'var(--bg-primary)',
                  }}
                >
                  {creating ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      {t['dashboard.analyzing']}
                    </span>
                  ) : (
                    t['dashboard.confirmAdd']
                  )}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Quadrant Board */}
        <QuadrantBoard
          tasks={tasks}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          onQuadrantChange={handleQuadrantChange}
          onDateChange={handleDateChange}
        />

        {/* Stats Section */}
        <StatsSection selectedDate={selectedDate} dateFilter={dateFilter} />

        {/* AI Mascot */}
        <Mascot />
      </main>
    </div>
  )
}
