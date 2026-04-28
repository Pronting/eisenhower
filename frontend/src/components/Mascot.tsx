'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || '/api'

async function fetchAdvice(): Promise<string> {
  const token = localStorage.getItem('token')
  const res = await fetch(`${API}/agent/advice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) throw new Error('Failed')
  const json = await res.json()
  return json.data.advice
}

export default function Mascot() {
  const oml2dRef = useRef<any>(null)
  const loadingRef = useRef(false)
  const readyRef = useRef(false)
  const [mascotHidden, setMascotHidden] = useState(false)
  const [ready, setReady] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile — don't render mascot at all on small screens
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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

  useEffect(() => {
    let instance: any = null
    let mounted = true

    // Clear stale localStorage status that would override initialStatus
    // The library checks localStorage first (J0()), and if "sleep",
    // it shows a hidden statusBar instead of calling stageSlideIn().
    // Since we hide the statusBar (display:none), this creates a deadlock.
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
            scale: 0.10,
            position: [15, 50],
            anchor: [0, 0],
            volume: 0,
            stageStyle: {
              width: 200,
              height: 280,
            },
          },
        ],

        tips: {
          messageLine: 3,
          style: {
            width: 220,
            height: 70,
            transform: 'translateY(20px)',
            fontSize: '13px',
            lineHeight: '1.4',
            padding: '8px 12px',
            borderRadius: '14px',
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

            // Attach click-to-advice handler directly on the library's canvas
            const canvas = instance.stage?.canvasElement as HTMLCanvasElement | null
            if (canvas && !canvas.dataset.mascotReady) {
              canvas.dataset.mascotReady = '1'
              canvas.style.cursor = 'pointer'
              canvas.addEventListener('click', showAdvice)
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

  const btnBase = "fixed left-4 z-[9999] flex items-center justify-center rounded-full text-base shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl"

  // Don't render anything on mobile
  if (isMobile) return null

  // Loading — show spinner
  if (!ready) {
    return (
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
    )
  }

  // Hidden — show restore button
  if (mascotHidden) {
    return (
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
    )
  }

  // Visible — show close button
  return (
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
}
