'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

const API = process.env.NEXT_PUBLIC_API_URL || '/api'

async function fetchJson(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token')
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) throw new Error('Failed')
  const json = await res.json()
  return json.data
}

async function fetchAdvice(): Promise<string> {
  const data = await fetchJson('/agent/advice', { method: 'POST' })
  return data.advice
}

async function fetchDailySummary(): Promise<string> {
  const data = await fetchJson('/agent/summary-v2/daily', { method: 'POST' })
  return data.summary || ''
}

const DRAG_POS_KEY = 'ishwe_mascot_pos'

function loadPos(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(DRAG_POS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function savePos(x: number, y: number) {
  localStorage.setItem(DRAG_POS_KEY, JSON.stringify({ x, y }))
}

export default function Mascot() {
  const oml2dRef = useRef<any>(null)
  const loadingRef = useRef(false)
  const readyRef = useRef(false)
  const [mascotHidden, setMascotHidden] = useState(false)
  const [ready, setReady] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Drag state
  const dragRef = useRef({ active: false, startX: 0, startY: 0, elX: 0, elY: 0 })
  const posRef = useRef(loadPos())

  // Auto-push timer ref
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const initPopRef = useRef(false)

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const showBubble = useCallback(async (text: string, duration: number) => {
    const instance = oml2dRef.current
    instance?.tipsMessage?.(text, duration)
  }, [])

  const autoPush = useCallback(async () => {
    if (mascotHidden || !readyRef.current) return
    try {
      const summary = await fetchDailySummary()
      if (summary) {
        showBubble(`📋 ${summary}`, 8000)
      }
    } catch {
      // silent fail — auto-push is nice-to-have
    }
  }, [mascotHidden, showBubble])

  const showAdvice = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    const instance = oml2dRef.current

    try {
      instance?.tipsMessage?.('让我看看你的任务... 🤔', 2000)
      const advice = await fetchAdvice()
      instance?.tipsMessage?.(advice, 6000)
    } catch {
      instance?.tipsMessage?.('网络不太稳定，稍后再试吧~', 3000)
    } finally {
      loadingRef.current = false
    }
  }, [])

  // Auto-push interval — every 5 min
  useEffect(() => {
    if (!ready || mascotHidden) return

    // First auto-push after 3s delay
    if (!initPopRef.current) {
      initPopRef.current = true
      const t = setTimeout(() => autoPush(), 3000)
      timerRef.current = setInterval(() => autoPush(), 5 * 60 * 1000)
      return () => {
        clearTimeout(t)
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }
  }, [ready, mascotHidden, autoPush])

  // Drag handlers
  const onDragStart = useCallback((e: MouseEvent) => {
    const stage = oml2dRef.current?.stage
    if (!stage) return
    const el = stage.canvasElement?.parentElement as HTMLElement | null
    if (!el) return

    dragRef.current.active = true
    dragRef.current.startX = e.clientX
    dragRef.current.startY = e.clientY
    dragRef.current.elX = el.offsetLeft || 0
    dragRef.current.elY = el.offsetTop || 0
    el.style.cursor = 'grabbing'
    e.preventDefault()
  }, [])

  const onDragMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current.active) return
    const stage = oml2dRef.current?.stage
    if (!stage) return
    const el = stage.canvasElement?.parentElement as HTMLElement | null
    if (!el) return

    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    const nx = dragRef.current.elX + dx
    const ny = dragRef.current.elY + dy

    el.style.position = 'fixed'
    el.style.left = `${nx}px`
    el.style.top = `${ny}px`
    el.style.right = 'auto'
    el.style.bottom = 'auto'
  }, [])

  const onDragEnd = useCallback((e: MouseEvent) => {
    if (!dragRef.current.active) return
    dragRef.current.active = false

    const stage = oml2dRef.current?.stage
    if (!stage) return
    const el = stage.canvasElement?.parentElement as HTMLElement | null
    if (el) {
      el.style.cursor = 'pointer'
      const x = el.offsetLeft || 0
      const y = el.offsetTop || 0
      savePos(x, y)
      posRef.current = { x, y }
    }
  }, [])

  // Attach drag listeners
  useEffect(() => {
    if (!ready) return
    const canvas = oml2dRef.current?.stage?.canvasElement as HTMLCanvasElement | null
    if (!canvas) return

    canvas.addEventListener('mousedown', onDragStart)
    window.addEventListener('mousemove', onDragMove)
    window.addEventListener('mouseup', onDragEnd)

    return () => {
      canvas.removeEventListener('mousedown', onDragStart)
      window.removeEventListener('mousemove', onDragMove)
      window.removeEventListener('mouseup', onDragEnd)
    }
  }, [ready, onDragStart, onDragMove, onDragEnd])

  // Restore saved position
  useEffect(() => {
    if (!ready) return
    const pos = posRef.current
    if (!pos) return
    const intv = setInterval(() => {
      const stage = oml2dRef.current?.stage
      const el = stage?.canvasElement?.parentElement as HTMLElement | null
      if (el) {
        el.style.position = 'fixed'
        el.style.left = `${pos.x}px`
        el.style.top = `${pos.y}px`
        el.style.right = 'auto'
        el.style.bottom = 'auto'
        clearInterval(intv)
      }
    }, 200)
    return () => clearInterval(intv)
  }, [ready])

  useEffect(() => {
    let instance: any = null
    let mounted = true

    localStorage.removeItem('OML2D_STATUS')

    const init = async () => {
      const { loadOml2d } = await import('oh-my-live2d')

      if (!mounted) return

      instance = loadOml2d({
        dockedPosition: 'left',
        mobileDisplay: false,
        primaryColor: '#6366f1',
        sayHello: false,
        transitionTime: 800,
        initialStatus: 'active',

        models: [
          {
            name: 'Senko',
            path: 'https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model/Live2D/Senko_Normals/senko.model3.json',
            scale: 0.07,
            position: [15, 10],
            anchor: [0, 0],
            volume: 0,
            stageStyle: {
              width: 160,
              height: 220,
            },
          },
        ],

        tips: {
          messageLine: 3,
          style: {
            width: 200,
            height: 64,
            transform: 'translateY(-32px)',
            fontSize: '12px',
            lineHeight: '1.4',
            padding: '6px 10px',
            borderRadius: '12px',
            backgroundColor: 'rgba(30,30,40,0.92)',
            color: '#e8e8f0',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          },
          idleTips: {
            wordTheDay: false,
            duration: 4000,
            priority: 2,
            interval: 15000,
            message: [
              '戳我一下，看看今天该做什么~ ✨',
              '需要优先级建议吗？点我！',
              '艾森豪威尔矩阵 — 分清轻重缓急',
              '今天有哪些任务呢？让 AI 帮你分析',
            ],
          },
          welcomeTips: {
            duration: 3000,
            priority: 3,
            message: {
              daybreak: '早上好！点击我获取今日任务建议 ☀️',
              morning: '上午好！看看今天的优先级排序吧 📋',
              noon: '中午好！休息一下，检查待办事项 🍜',
              afternoon: '下午好！效率最高的时候，需要建议吗？💪',
              dusk: '傍晚好！今天做完了多少任务呢？🌅',
              night: '晚上好！需要复盘今天的进度吗？🌙',
              lateNight: '还不睡？看看明天的任务安排吧 😴',
              weeHours: '夜深了，注意休息哦！明早再做规划 🌙',
            },
          },
        },

        menus: {
          disable: true,
        },

        statusBar: {
          style: { display: 'none' },
        },
      })

      if (mounted) {
        oml2dRef.current = instance

        instance.onLoad((status: string) => {
          if (status === 'success') {
            readyRef.current = true
            setReady(true)

            const canvas = instance.stage?.canvasElement as HTMLCanvasElement | null
            if (canvas && !canvas.dataset.mascotReady) {
              canvas.dataset.mascotReady = '1'
              canvas.style.cursor = 'pointer'
              canvas.style.pointerEvents = 'auto'
              canvas.addEventListener('click', showAdvice)
            }
            // Make the mascot container non-blocking for other UI elements
            const container = canvas?.parentElement
            if (container) {
              container.style.pointerEvents = 'none'
            }
          }
        })

        instance.onStageSlideOut(() => {
          setMascotHidden(true)
        })
        instance.onStageSlideIn(() => {
          setMascotHidden(false)
        })
      }
    }

    init()

    return () => {
      mounted = false
      if (oml2dRef.current) {
        try {
          oml2dRef.current.stageSlideOut?.()
        } catch { /* ignore */ }
      }
    }
  }, [])

  const handleHide = () => {
    const instance = oml2dRef.current
    if (!instance) return
    if (typeof instance.stageSlideOut === 'function') {
      instance.stageSlideOut()
      setMascotHidden(true)
    }
  }

  const handleShow = () => {
    const instance = oml2dRef.current
    if (!instance) return
    if (typeof instance.stageSlideIn === 'function') {
      instance.stageSlideIn()
      setMascotHidden(false)
    }
  }

  const btnBase = "fixed left-4 z-[99999] flex items-center justify-center rounded-full text-base shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl pointer-events-auto"

  if (isMobile) return null

  const btn = !ready ? (
    <span
      className={`${btnBase} bottom-24 w-10 h-10`}
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-medium)',
        color: 'var(--text-muted)',
        opacity: 0.3,
      }}
      title="看板娘加载中…"
    >
      ⏳
    </span>
  ) : mascotHidden ? (
    <button
      onClick={handleShow}
      className={`${btnBase} bottom-24 w-10 h-10`}
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-medium)',
        color: 'var(--text-primary)',
        opacity: 0.45,
      }}
      title="显示看板娘"
    >
      🦊
    </button>
  ) : (
    <button
      onClick={handleHide}
      className={`${btnBase} bottom-24 w-10 h-10`}
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-medium)',
        color: 'var(--text-primary)',
      }}
      title="隐藏看板娘"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  )

  return createPortal(btn, document.body)
}
