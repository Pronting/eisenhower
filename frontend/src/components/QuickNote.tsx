'use client'

import { useState } from 'react'
import { getStoredToken } from '@/lib/desktop-auth'

const API = process.env.NEXT_PUBLIC_API_URL || '/api'

interface TaskItem {
  title: string
  description: string
  quadrant: string
  due_date: string
}

const QUADRANTS = [
  { key: 'q1', label: '重要紧急', icon: '🔥', color: '#ef4444' },
  { key: 'q2', label: '重要不紧急', icon: '📋', color: '#3b82f6' },
  { key: 'q3', label: '紧急不重要', icon: '⚡', color: '#f59e0b' },
  { key: 'q4', label: '不重要不紧急', icon: '📌', color: '#6b7280' },
]

export default function QuickNote() {
  const [mode, setMode] = useState<'manual' | 'ai'>('manual')
  const [tasks, setTasks] = useState<TaskItem[]>([
    { title: '', description: '', quadrant: 'q2', due_date: '' },
  ])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const addTask = () => {
    setTasks([...tasks, { title: '', description: '', quadrant: 'q2', due_date: '' }])
  }

  const removeTask = (index: number) => {
    if (tasks.length > 1) {
      setTasks(tasks.filter((_, i) => i !== index))
    }
  }

  const updateTask = (index: number, field: keyof TaskItem, value: string) => {
    const updated = [...tasks]
    updated[index] = { ...updated[index], [field]: value }
    setTasks(updated)
  }

  const handleAiSplit = async () => {
    if (!aiInput.trim()) {
      setError('请输入待办内容')
      return
    }

    setAiLoading(true)
    setError('')
    setMessage('')

    try {
      const token = getStoredToken()
      const res = await fetch(`${API}/notes/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content: aiInput }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'AI 拆分失败')
      }

      const data = await res.json()
      const aiTasks = data.data?.tasks || []

      if (aiTasks.length === 0) {
        setError('未识别到可执行的待办事项，请补充更多细节')
        return
      }

      setTasks(
        aiTasks.map((t: any) => ({
          title: t.title || '',
          description: t.description || '',
          quadrant: t.quadrant || 'q2',
          due_date: '',
        }))
      )
      setMessage(`AI 拆分为 ${aiTasks.length} 个任务，请确认后入库`)
      setAiInput('')
    } catch (err: any) {
      setError(err.message || 'AI 拆分失败')
    } finally {
      setAiLoading(false)
    }
  }

  const handleSubmit = async () => {
    const validTasks = tasks.filter(t => t.title.trim())
    if (validTasks.length === 0) {
      setError('请至少输入一个任务标题')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      const token = getStoredToken()
      const res = await fetch(`${API}/notes/quick-add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          tasks: validTasks.map(t => ({
            title: t.title,
            description: t.description || undefined,
            quadrant: t.quadrant,
            due_date: t.due_date || undefined,
          })),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || '入库失败')
      }

      const data = await res.json()
      setMessage(`成功创建 ${data.data.created} 个任务`)
      setTasks([{ title: '', description: '', quadrant: 'q2', due_date: '' }])
      setAiInput('')
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      setError(err.message || '入库失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="w-full h-full overflow-y-auto p-4"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-heading font-bold gradient-text">随处小记</h2>
        <button
          onClick={() => {
            try {
              const { invoke } = require('@tauri-apps/api/core')
              invoke('toggle_window')
            } catch {
              // Web fallback
            }
          }}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title="关闭"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4L12 12M4 12L12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
        <button
          onClick={() => setMode('manual')}
          className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: mode === 'manual' ? 'var(--bg-primary)' : 'transparent',
            color: mode === 'manual' ? 'var(--text-primary)' : 'var(--text-muted)',
          }}
        >
          手动输入
        </button>
        <button
          onClick={() => setMode('ai')}
          className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: mode === 'ai' ? 'var(--bg-primary)' : 'transparent',
            color: mode === 'ai' ? 'var(--text-primary)' : 'var(--text-muted)',
          }}
        >
          AI 拆分
        </button>
      </div>

      {/* Status messages */}
      {message && (
        <div
          className="p-2 rounded-lg mb-3 text-sm"
          style={{ backgroundColor: '#22c55e10', border: '1px solid #22c55e30', color: '#22c55e' }}
        >
          {message}
        </div>
      )}
      {error && (
        <div
          className="p-2 rounded-lg mb-3 text-sm"
          style={{ backgroundColor: '#ef444410', border: '1px solid #ef444430', color: '#ef4444' }}
        >
          {error}
        </div>
      )}

      {/* AI input mode */}
      {mode === 'ai' && (
        <div className="mb-4">
          <textarea
            placeholder="输入待办内容，如：上午买菜，下午阅读，晚上健身..."
            value={aiInput}
            onChange={e => setAiInput(e.target.value)}
            rows={3}
            className="w-full rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-1 resize-none"
            style={{
              backgroundColor: 'var(--bg-card-hover)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
            }}
          />
          <button
            onClick={handleAiSplit}
            disabled={aiLoading}
            className="w-full py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
            style={{
              backgroundColor: '#8b5cf6',
              color: '#fff',
            }}
          >
            {aiLoading ? 'AI 分析中...' : '✨ AI 拆分'}
          </button>
        </div>
      )}

      {/* Task list */}
      {tasks.map((task, index) => (
        <div
          key={index}
          className="mb-4 p-3 rounded-xl"
          style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-medium)' }}
        >
          {/* Task header with remove button */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              任务 {index + 1}
            </span>
            {tasks.length > 1 && (
              <button
                onClick={() => removeTask(index)}
                className="text-xs p-1 rounded"
                style={{ color: 'var(--text-muted)' }}
              >
                删除
              </button>
            )}
          </div>

          {/* Title input */}
          <input
            type="text"
            placeholder="输入任务标题..."
            value={task.title}
            onChange={e => updateTask(index, 'title', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-1"
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
            }}
          />

          {/* Description input */}
          <textarea
            placeholder="描述（可选）..."
            value={task.description}
            onChange={e => updateTask(index, 'description', e.target.value)}
            rows={2}
            className="w-full rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-1 resize-none"
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
            }}
          />

          {/* Quadrant selector - 2x2 grid */}
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {QUADRANTS.map(q => (
              <button
                key={q.key}
                onClick={() => updateTask(index, 'quadrant', q.key)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: task.quadrant === q.key ? `${q.color}20` : 'var(--bg-primary)',
                  border: `1.5px solid ${task.quadrant === q.key ? q.color : 'var(--border-medium)'}`,
                  color: task.quadrant === q.key ? q.color : 'var(--text-secondary)',
                }}
              >
                <span>{q.icon}</span>
                <span>{q.label}</span>
              </button>
            ))}
          </div>

          {/* Due date */}
          <input
            type="date"
            value={task.due_date}
            onChange={e => updateTask(index, 'due_date', e.target.value)}
            className="w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1"
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      ))}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={addTask}
          className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
          style={{
            backgroundColor: 'var(--bg-card-hover)',
            border: '1px solid var(--border-medium)',
            color: 'var(--text-secondary)',
          }}
        >
          + 添加任务
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
          style={{
            backgroundColor: 'var(--text-primary)',
            color: 'var(--bg-primary)',
          }}
        >
          {loading ? '提交中...' : '确认入库'}
        </button>
      </div>
    </div>
  )
}
