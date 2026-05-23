'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'

const API = process.env.NEXT_PUBLIC_API_URL || '/api'

function DeviceAuthorizeContent() {
  const searchParams = useSearchParams()
  const userCode = searchParams.get('user_code') || ''

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // 验证 token 是否有效
    const token = localStorage.getItem('token')
    if (!token) {
      setIsLoggedIn(false)
      setChecking(false)
      return
    }

    // 用一个简单请求验证 token
    fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (res.ok) {
          setIsLoggedIn(true)
        } else {
          // token 无效，清除
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setIsLoggedIn(false)
        }
      })
      .catch(() => {
        // 请求失败，保守起见保留 token
        setIsLoggedIn(true)
      })
      .finally(() => setChecking(false))
  }, [])

  const handleConfirm = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      setError('请先登录后再确认授权')
      setIsLoggedIn(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(
        `${API}/auth/device/confirm?user_code=${encodeURIComponent(userCode)}&token=${encodeURIComponent(token)}`,
        { method: 'POST' }
      )

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 401) {
          // token 无效，清除并要求重新登录
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setIsLoggedIn(false)
          throw new Error('登录已过期，请重新登录')
        }
        throw new Error(data.detail || '授权确认失败')
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || '授权确认失败')
    } finally {
      setLoading(false)
    }
  }

  if (!userCode) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="glass p-8 max-w-md w-full mx-4">
          <h1 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            无效的授权请求
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            缺少 user_code 参数，请从桌面应用重新发起授权。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div className="fixed inset-0 bg-grid-animated pointer-events-none" style={{ opacity: 0.3 }} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="glass p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-heading font-bold gradient-text mb-2">
              ishwe
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              桌面端授权确认
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

          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div
                className="p-4 rounded-xl mb-4"
                style={{
                  backgroundColor: '#22c55e10',
                  border: '1px solid #22c55e30',
                }}
              >
                <p className="text-lg font-semibold" style={{ color: '#22c55e' }}>
                  授权成功
                </p>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                您可以关闭此页面，桌面应用已获得授权。
              </p>
            </motion.div>
          ) : (
            <div className="text-center">
              {/* User Code Display */}
              <div className="mb-6">
                <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                  请确认以下验证码与桌面应用显示的一致：
                </p>
                <div
                  className="inline-block px-6 py-3 rounded-xl text-2xl font-mono font-bold tracking-wider"
                  style={{
                    backgroundColor: 'var(--bg-card-hover)',
                    border: '2px solid var(--neon-blue)',
                    color: 'var(--neon-blue)',
                  }}
                >
                  {userCode}
                </div>
              </div>

              {checking ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  检查登录状态...
                </p>
              ) : !isLoggedIn ? (
                <div>
                  <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                    请先登录后再确认授权
                  </p>
                  <a
                    href={`/login?redirect=${encodeURIComponent(`/device-authorize?user_code=${userCode}`)}`}
                    className="block w-full py-3 font-semibold rounded-xl text-center transition-all duration-300 hover:shadow-md"
                    style={{
                      backgroundColor: 'var(--text-primary)',
                      color: 'var(--bg-primary)',
                    }}
                  >
                    去登录
                  </a>
                </div>
              ) : (
                <div>
                  <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                    点击下方按钮，授权桌面应用访问您的账户
                  </p>
                  <button
                    onClick={handleConfirm}
                    disabled={loading}
                    className="w-full py-3 font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:shadow-md"
                    style={{
                      backgroundColor: 'var(--text-primary)',
                      color: 'var(--bg-primary)',
                    }}
                  >
                    {loading ? '确认中...' : '确认授权'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default function DeviceAuthorizePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DeviceAuthorizeContent />
    </Suspense>
  )
}
