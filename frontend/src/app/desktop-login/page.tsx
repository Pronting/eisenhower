'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useLang } from '@/i18n/LanguageContext'
import {
  hasValidToken,
  requestDeviceCode,
  pollForToken,
  storeToken,
  type DeviceCodeResponse,
} from '@/lib/desktop-auth'

async function openUrl(url: string) {
  try {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(url)
  } catch {
    window.open(url, '_blank')
  }
}

export default function DesktopLoginPage() {
  const router = useRouter()
  const { t } = useLang()
  const [step, setStep] = useState<'init' | 'waiting' | 'error'>('init')
  const [deviceData, setDeviceData] = useState<DeviceCodeResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const hasStartedRef = useRef(false)

  const startAuth = useCallback(async () => {
    if (hasStartedRef.current) return
    hasStartedRef.current = true

    setLoading(true)
    setError('')
    try {
      const data = await requestDeviceCode()
      setDeviceData(data)
      setStep('waiting')

      // Open browser for authorization
      const origin = window.location.origin
      const authUrl = `${origin}/device-authorize?user_code=${data.user_code}`
      await openUrl(authUrl)

      // Start polling for token
      const interval = data.interval || 5
      pollRef.current = setInterval(async () => {
        try {
          const result = await pollForToken(data.device_code)
          if (result) {
            // Token received
            if (pollRef.current) clearInterval(pollRef.current)
            storeToken(result.access_token)
            router.push('/quick-note')
          }
        } catch (err: any) {
          if (pollRef.current) clearInterval(pollRef.current)
          setError(err.message || '授权失败')
          setStep('error')
        }
      }, interval * 1000)
    } catch (err: any) {
      setError(err.message || '获取授权码失败')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }, [router])

  // Redirect if already authenticated, otherwise auto-start auth
  useEffect(() => {
    if (hasValidToken()) {
      router.push('/quick-note')
    } else {
      // Auto-start OAuth flow on mount
      startAuth()
    }
  }, [router, startAuth])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const retry = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    setStep('init')
    setError('')
    setDeviceData(null)
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div className="fixed inset-0 bg-grid-animated pointer-events-none" style={{ opacity: 0.3 }} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-heading font-bold gradient-text mb-2">
              ishwe
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              桌面端登录
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl mb-6 text-sm"
              style={{
                backgroundColor: '#ef444410',
                border: '1px solid #ef444420',
                color: '#ef4444',
              }}
            >
              {error}
            </motion.div>
          )}

          {step === 'init' && (
            <div className="text-center">
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                点击下方按钮，在浏览器中完成授权登录
              </p>
              <button
                onClick={startAuth}
                disabled={loading}
                className="w-full py-3 font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:shadow-md"
                style={{
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--bg-primary)',
                }}
              >
                {loading ? '正在获取授权...' : '开始登录'}
              </button>
            </div>
          )}

          {step === 'waiting' && deviceData && (
            <div className="text-center">
              <div className="mb-4">
                <div
                  className="inline-block px-4 py-2 rounded-xl text-lg font-mono font-bold tracking-wider"
                  style={{
                    backgroundColor: 'var(--bg-card-hover)',
                    border: '2px solid var(--neon-blue)',
                    color: 'var(--neon-blue)',
                  }}
                >
                  {deviceData.user_code}
                </div>
              </div>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                浏览器已打开授权页面，请在浏览器中输入以上验证码并确认授权
              </p>
              <div className="flex items-center justify-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                等待授权确认...
              </div>
              <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
                验证码有效期 5 分钟
              </p>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center">
              <button
                onClick={retry}
                className="w-full py-3 font-semibold rounded-xl transition-all duration-300 hover:shadow-md"
                style={{
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--bg-primary)',
                }}
              >
                重试
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
