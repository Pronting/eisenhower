'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

const API = process.env.NEXT_PUBLIC_API_URL || '/api'

export default function DeviceAuthorizePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const userCode = searchParams.get('user_code') || ''

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'no_code' | 'not_logged_in'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!userCode) {
      setStatus('no_code')
      return
    }
    const token = localStorage.getItem('token')
    if (!token) {
      setStatus('not_logged_in')
    }
  }, [userCode])

  const handleAuthorize = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      setStatus('not_logged_in')
      return
    }

    setStatus('loading')
    setMessage('')

    try {
      const res = await fetch(`${API}/auth/device/authorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ user_code: userCode }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || data.message || '授权失败')
      }

      setStatus('success')
      setMessage('授权成功！桌面端已获得访问权限，您可以关闭此页面。')
    } catch (err: any) {
      setStatus('error')
      setMessage(err.message)
    }
  }

  const handleGoToLogin = () => {
    // Save the current URL so we can redirect back after login
    localStorage.setItem('device_auth_redirect', window.location.href)
    router.push('/login')
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
            返回首页
          </Link>
          <ThemeToggle />
        </div>

        <div className="glass p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-heading font-bold gradient-text mb-2">
              设备授权
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              桌面端请求访问您的账号
            </p>
          </div>

          {status === 'no_code' && (
            <div className="text-center">
              <p className="text-sm mb-4" style={{ color: '#ef4444' }}>
                缺少授权码参数。请从桌面端获取正确的授权链接。
              </p>
              <Link
                href="/dashboard"
                className="text-sm"
                style={{ color: 'var(--neon-blue)' }}
              >
                返回仪表盘
              </Link>
            </div>
          )}

          {status === 'not_logged_in' && (
            <div className="text-center">
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                您需要先登录才能授权设备。
              </p>
              <button
                onClick={handleGoToLogin}
                className="w-full py-3 font-semibold rounded-xl transition-all duration-300 hover:shadow-md"
                style={{
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--bg-primary)',
                }}
              >
                去登录
              </button>
            </div>
          )}

          {(status === 'idle' || status === 'loading') && (
            <div className="text-center">
              <div
                className="inline-block px-6 py-4 rounded-xl mb-6 text-lg font-mono font-bold tracking-wider"
                style={{
                  backgroundColor: 'var(--bg-card-hover)',
                  border: '2px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                  letterSpacing: '0.15em',
                }}
              >
                {userCode}
              </div>

              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                请确认以上授权码与桌面端显示的一致，然后点击授权。
              </p>

              <button
                onClick={handleAuthorize}
                disabled={status === 'loading'}
                className="w-full py-3 font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:shadow-md"
                style={{
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--bg-primary)',
                }}
              >
                {status === 'loading' ? '授权中...' : '确认授权'}
              </button>
            </div>
          )}

          {status === 'success' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="text-4xl mb-4">&#10003;</div>
              <p className="text-sm mb-4" style={{ color: '#22c55e' }}>
                {message}
              </p>
              <Link
                href="/dashboard"
                className="text-sm"
                style={{ color: 'var(--neon-blue)' }}
              >
                返回仪表盘
              </Link>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <p
                className="p-3 rounded-xl mb-4 text-sm"
                style={{ backgroundColor: '#ef444410', border: '1px solid #ef444420', color: '#ef4444' }}
              >
                {message}
              </p>
              <button
                onClick={() => setStatus('idle')}
                className="text-sm"
                style={{ color: 'var(--neon-blue)' }}
              >
                重试
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
