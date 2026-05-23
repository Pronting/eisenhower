'use client'

import { useState, useEffect, useCallback } from 'react'
import { getStoredToken, validateToken, clearToken, getFetch } from '@/lib/desktop-auth'

const API = process.env.NEXT_PUBLIC_API_URL || '/api'
const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000'

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

// 获取今天的日期，格式为 YYYY-MM-DD
function getTodayDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function QuickNote() {
  const [activeTab, setActiveTab] = useState<'manual' | 'ai' | 'settings'>('manual')
  const [tasks, setTasks] = useState<TaskItem[]>([
    { title: '', description: '', quadrant: 'q2', due_date: '' },
  ])
  const [aiInput, setAiInput] = useState('')
  const [aiTasks, setAiTasks] = useState<TaskItem[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [authValid, setAuthValid] = useState<boolean | null>(null)
  const [mounted, setMounted] = useState(false)
  const [shortcut, setShortcut] = useState(() => {
    if (typeof window === 'undefined') return 'Ctrl+Shift+F7'
    return localStorage.getItem('shortcut') || 'Ctrl+Shift+F7'
  })
  const [shortcutInput, setShortcutInput] = useState(shortcut)
  const [shortcutMessage, setShortcutMessage] = useState('')

  // Token 验证逻辑
  const checkAuth = useCallback(async () => {
    const isValid = await validateToken()
    setAuthValid(isValid)
  }, [])

  // 客户端挂载后初始化
  useEffect(() => {
    if (mounted) return
    setMounted(true)

    const init = async () => {
      // 检查是否有 token
      const token = getStoredToken()
      if (!token) {
        setAuthValid(false)
      } else {
        await checkAuth()
      }

      // 通知 Rust 端页面已加载
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('show_main_window')

        // 注册用户保存的快捷键
        const savedShortcut = localStorage.getItem('shortcut')
        if (savedShortcut) {
          try {
            await invoke('update_shortcut', { shortcutStr: savedShortcut })
          } catch {
            // 快捷键注册失败，忽略
          }
        }
      } catch {
        // Web fallback - not in Tauri environment
      }
    }
    init()

    // 每 30 分钟验证一次 token
    const interval = setInterval(checkAuth, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [checkAuth, mounted])

  // 重新授权
  const [reauthLoading, setReauthLoading] = useState(false)
  const handleReauth = async () => {
    clearToken()
    setReauthLoading(true)
    setError('')
    try {
      const { requestDeviceCode, pollForToken, storeToken } = await import('@/lib/desktop-auth')
      const data = await requestDeviceCode()

      // 在浏览器中打开授权页面（使用真实的网页地址，不是 Tauri 内部地址）
      const authUrl = `${WEB_URL}/device-authorize?user_code=${data.user_code}`
      try {
        const { open } = await import('@tauri-apps/plugin-shell')
        await open(authUrl)
      } catch {
        window.open(authUrl, '_blank')
      }

      // 轮询等待授权成功
      const interval = data.interval || 5
      const maxAttempts = 60 // 最多等待 5 分钟
      let attempts = 0

      const poll = setInterval(async () => {
        attempts++
        if (attempts > maxAttempts) {
          clearInterval(poll)
          setReauthLoading(false)
          setError('授权超时，请重试')
          return
        }

        try {
          const result = await pollForToken(data.device_code)
          if (result) {
            clearInterval(poll)
            storeToken(result.access_token)
            setAuthValid(true)
            setReauthLoading(false)
          }
        } catch (err: any) {
          clearInterval(poll)
          setReauthLoading(false)
          setError(err.message || '授权失败')
        }
      }, interval * 1000)
    } catch (err: any) {
      setReauthLoading(false)
      setError(err.message || '获取授权码失败')
    }
  }

  // 登出功能
  const handleLogout = () => {
    clearToken()
    setAuthValid(false)
    setActiveTab('manual')
  }

  // 保存快捷键
  const handleSaveShortcut = async () => {
    setShortcutMessage('')
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const result = await invoke<string>('update_shortcut', { shortcutStr: shortcutInput })
      setShortcut(shortcutInput)
      localStorage.setItem('shortcut', shortcutInput)
      setShortcutMessage(result)
      setTimeout(() => setShortcutMessage(''), 3000)
    } catch (err: any) {
      setShortcutMessage(err.message || '保存快捷键失败')
    }
  }

  // 监听快捷键输入
  const handleShortcutKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault()
    const parts: string[] = []
    if (e.ctrlKey) parts.push('Ctrl')
    if (e.shiftKey) parts.push('Shift')
    if (e.altKey) parts.push('Alt')
    if (e.metaKey) parts.push('Super')

    // 获取按键名称
    let key = e.key
    if (key === ' ') key = 'Space'
    else if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return
    else if (key.length === 1) key = key.toUpperCase()

    parts.push(key)
    setShortcutInput(parts.join('+'))
  }

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

  const updateAiTask = (index: number, field: keyof TaskItem, value: string) => {
    const updated = [...aiTasks]
    updated[index] = { ...updated[index], [field]: value }
    setAiTasks(updated)
  }

  const removeAiTask = (index: number) => {
    if (aiTasks.length > 1) {
      setAiTasks(aiTasks.filter((_, i) => i !== index))
    }
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
      const fetchFn = await getFetch()
      const res = await fetchFn(`${API}/notes/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content: aiInput }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || '智能拆分失败')
      }

      const data = await res.json()
      const tasks = data.data?.tasks || []

      if (tasks.length === 0) {
        setError('未识别到可执行的待办事项，请补充更多细节')
        return
      }

      setAiTasks(
        tasks.map((t: any) => ({
          title: t.title || '',
          description: t.description || '',
          quadrant: t.quadrant || 'q2',
          due_date: '',
        }))
      )
      setMessage(`已拆分为 ${tasks.length} 个任务，请确认`)
      setAiInput('')
    } catch (err: any) {
      setError(err.message || '智能拆分失败')
    } finally {
      setAiLoading(false)
    }
  }

  const handleAiSubmit = async () => {
    const validTasks = aiTasks.filter(t => t.title.trim())
    if (validTasks.length === 0) {
      setError('请至少有一个有效任务')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    const today = getTodayDate()

    try {
      const token = getStoredToken()
      const fetchFn = await getFetch()
      const res = await fetchFn(`${API}/notes/quick-add`, {
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
            due_date: t.due_date || today,
          })),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || '入库失败')
      }

      const data = await res.json()
      setMessage(`成功创建 ${data.data.created} 个任务`)
      setAiTasks([])
      setAiInput('')
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      setError(err.message || '入库失败')
    } finally {
      setLoading(false)
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

    const today = getTodayDate()

    try {
      const token = getStoredToken()
      const fetchFn = await getFetch()
      const res = await fetchFn(`${API}/notes/quick-add`, {
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
            due_date: t.due_date || today,
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
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      setError(err.message || '入库失败')
    } finally {
      setLoading(false)
    }
  }

  // 未授权状态
  if (authValid === false) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center p-4"
        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      >
        <div className="text-center">
          <h2 className="text-lg font-heading font-bold gradient-text mb-2">需要重新授权</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            登录状态已失效，请重新授权
          </p>
          {error && (
            <p className="text-sm mb-4" style={{ color: '#ef4444' }}>
              {error}
            </p>
          )}
          <button
            onClick={handleReauth}
            disabled={reauthLoading}
            className="px-6 py-2 rounded-xl text-sm font-semibold transition-all hover:shadow-md disabled:opacity-50"
            style={{
              backgroundColor: 'var(--text-primary)',
              color: 'var(--bg-primary)',
            }}
          >
            {reauthLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                等待授权...
              </span>
            ) : '重新授权'}
          </button>
          {reauthLoading && (
            <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
              请在浏览器中完成授权
            </p>
          )}
        </div>
      </div>
    )
  }

  // 加载中状态 - 只在真正验证中时显示
  if (authValid === null) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center p-4"
        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      >
        <div className="text-center">
          <svg className="animate-spin h-6 w-6 mx-auto mb-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            验证登录状态...
          </p>
        </div>
      </div>
    )
  }

  // 设置页面
  if (activeTab === 'settings') {
    return (
      <div
        className="w-full h-full overflow-y-auto p-4"
        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setActiveTab('manual')}
            className="flex items-center gap-1 text-sm cursor-pointer"
            style={{ color: 'var(--neon-blue)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            返回
          </button>
          <h2 data-tauri-drag-region className="text-lg font-heading font-bold gradient-text cursor-grab active:cursor-grabbing">设置</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={async () => {
                try {
                  const { invoke } = await import('@tauri-apps/api/core')
                  await invoke('hide_window')
                } catch {
                  // Web fallback
                }
              }}
              className="p-1.5 rounded-lg transition-colors hover:opacity-80 cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
              title="最小化"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 8H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <button
              onClick={async () => {
                try {
                  const { invoke } = await import('@tauri-apps/api/core')
                  await invoke('close_window')
                } catch {
                  // Web fallback
                }
              }}
              className="p-1.5 rounded-lg transition-colors hover:opacity-80 cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
              title="关闭到托盘"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4L12 12M4 12L12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Shortcut setting */}
        <div
          className="p-4 rounded-xl"
          style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-medium)' }}
        >
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>快捷键设置</h3>

          <div className="mb-4">
            <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
              快捷键唤起面板
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={shortcutInput}
                onKeyDown={handleShortcutKeyDown}
                readOnly
                className="flex-1 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                }}
                placeholder="按下快捷键组合..."
              />
              <button
                onClick={handleSaveShortcut}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--bg-primary)',
                }}
              >
                保存
              </button>
            </div>
            {shortcutMessage && (
              <p className="text-xs mt-1.5" style={{ color: shortcutMessage.includes('成功') ? '#22c55e' : '#ef4444' }}>
                {shortcutMessage}
              </p>
            )}
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              当前: {shortcut}
            </p>
          </div>
        </div>

        {/* Logout button */}
        <div className="mt-4">
          <button
            onClick={handleLogout}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              backgroundColor: '#ef444410',
              border: '1px solid #ef444430',
              color: '#ef4444',
            }}
          >
            登出
          </button>
        </div>
      </div>
    )
  }

  // 智能拆分页面
  if (activeTab === 'ai') {
    return (
      <div
        className="w-full h-full overflow-y-auto p-4"
        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 data-tauri-drag-region className="flex-1 text-lg font-heading font-bold gradient-text cursor-grab active:cursor-grabbing">随处小记</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('settings')}
              className="p-1.5 rounded-lg transition-colors hover:opacity-80 cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
              title="设置"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
            <button
              onClick={async () => {
                try {
                  const { invoke } = await import('@tauri-apps/api/core')
                  await invoke('hide_window')
                } catch {
                  // Web fallback
                }
              }}
              className="p-1.5 rounded-lg transition-colors hover:opacity-80 cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
              title="最小化"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 8H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <button
              onClick={async () => {
                try {
                  const { invoke } = await import('@tauri-apps/api/core')
                  await invoke('close_window')
                } catch {
                  // Web fallback
                }
              }}
              className="p-1.5 rounded-lg transition-colors hover:opacity-80 cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
              title="关闭到托盘"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4L12 12M4 12L12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
          <button
            onClick={() => {
              setActiveTab('manual')
              setError('')
              setMessage('')
            }}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
            }}
          >
            手动输入
          </button>
          <button
            onClick={() => {}}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
            }}
          >
            智能拆分
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

        {/* AI input */}
        {aiTasks.length === 0 ? (
          <div className="mb-4">
            <textarea
              placeholder="输入待办内容，如：上午买菜，下午阅读，晚上健身..."
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              rows={4}
              className="w-full rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-1 resize-none"
              style={{
                backgroundColor: 'var(--bg-card-hover)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              onClick={handleAiSplit}
              disabled={aiLoading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
              style={{
                backgroundColor: '#8b5cf6',
                color: '#fff',
              }}
            >
              {aiLoading ? '分析中...' : '✨ 智能拆分'}
            </button>
          </div>
        ) : (
          <>
            {/* AI result tasks */}
            {aiTasks.map((task, index) => (
              <div
                key={index}
                className="mb-3 p-3 rounded-xl"
                style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-medium)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    任务 {index + 1}
                  </span>
                  {aiTasks.length > 1 && (
                    <button
                      onClick={() => removeAiTask(index)}
                      className="text-xs p-1 rounded"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      删除
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="任务标题..."
                  value={task.title}
                  onChange={e => updateAiTask(index, 'title', e.target.value)}
                  className="w-full rounded-lg px-3 py-1.5 text-sm mb-2 focus:outline-none focus:ring-1"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                  }}
                />

                <textarea
                  placeholder="描述（可选）..."
                  value={task.description}
                  onChange={e => updateAiTask(index, 'description', e.target.value)}
                  rows={1}
                  className="w-full rounded-lg px-3 py-1.5 text-sm mb-2 focus:outline-none focus:ring-1 resize-none"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                  }}
                />

                <div className="grid grid-cols-2 gap-1.5">
                  {QUADRANTS.map(q => (
                    <button
                      key={q.key}
                      onClick={() => updateAiTask(index, 'quadrant', q.key)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all"
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
              </div>
            ))}

            {/* AI action buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setAiTasks([])
                  setMessage('')
                  setError('')
                }}
                className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
                style={{
                  backgroundColor: 'var(--bg-card-hover)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-secondary)',
                }}
              >
                重新输入
              </button>
              <button
                onClick={handleAiSubmit}
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
          </>
        )}
      </div>
    )
  }

  // 手动输入页面（默认）
  return (
    <div
      className="w-full h-full overflow-y-auto p-4"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      {/* Header - 只在标题区域设置拖拽，按钮区域不受影响 */}
      <div className="flex items-center justify-between mb-4">
        <h2 data-tauri-drag-region className="flex-1 text-lg font-heading font-bold gradient-text cursor-grab active:cursor-grabbing">随处小记</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('settings')}
            className="p-1.5 rounded-lg transition-colors hover:opacity-80 cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
            title="设置"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          <button
            onClick={async () => {
              try {
                const { invoke } = await import('@tauri-apps/api/core')
                await invoke('hide_window')
              } catch {
                // Web fallback
              }
            }}
            className="p-1.5 rounded-lg transition-colors hover:opacity-80 cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
            title="最小化"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 8H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={async () => {
              try {
                const { invoke } = await import('@tauri-apps/api/core')
                await invoke('close_window')
              } catch {
                // Web fallback
              }
            }}
            className="p-1.5 rounded-lg transition-colors hover:opacity-80 cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
            title="关闭到托盘"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M4 12L12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
        <button
          onClick={() => {}}
          className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
          }}
        >
          手动输入
        </button>
        <button
          onClick={() => {
            setActiveTab('ai')
            setError('')
            setMessage('')
          }}
          className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: 'transparent',
            color: 'var(--text-muted)',
          }}
        >
          智能拆分
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

      {/* Task list */}
      {tasks.map((task, index) => (
        <div
          key={index}
          className="mb-3 p-3 rounded-xl"
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
            className="w-full rounded-lg px-3 py-1.5 text-sm mb-2 focus:outline-none focus:ring-1"
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
            rows={1}
            className="w-full rounded-lg px-3 py-1.5 text-sm mb-2 focus:outline-none focus:ring-1 resize-none"
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
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all"
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
