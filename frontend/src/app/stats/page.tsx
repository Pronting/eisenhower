'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Header from '@/components/Header'
import { useLang } from '@/i18n/LanguageContext'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'

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

const QUADRANT_COLORS: Record<string, string> = {
  q1: '#ef4444',
  q2: '#f59e0b',
  q3: '#3b82f6',
  q4: '#8b5cf6',
}

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="glass-sm px-3 py-2 text-xs">
        <span style={{ color: 'var(--text-muted)' }}>{payload[0].name}: </span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{payload[0].value}</span>
      </div>
    )
  }
  return null
}

export default function StatsPage() {
  const router = useRouter()
  const { t } = useLang()
  const [user, setUser] = useState<{ username: string } | null>(null)
  const [quadrantData, setQuadrantData] = useState<any[]>([])
  const [completionRate, setCompletionRate] = useState(0)
  const [trends, setTrends] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const u = localStorage.getItem('user')
    const token = localStorage.getItem('token')
    if (!u || !token) {
      router.push('/login')
      return
    }
    setUser(JSON.parse(u))
    fetchData()
  }, [router])

  const fetchData = async () => {
    try {
      const [quadrantRes, completionRes, trendsRes] = await Promise.all([
        apiFetch('/stats/quadrant'),
        apiFetch('/stats/completion'),
        apiFetch('/stats/trends?days=7'),
      ])
      const qMap = quadrantRes.data || {}
      const qData = Object.keys(qMap).map(key => ({
        name: t[`quadrant.${key}.label`] || key,
        value: qMap[key],
        quadrant: key,
      }))
      setQuadrantData(qData)
      setCompletionRate(completionRes.data?.rate ?? 0)
      setTrends(trendsRes.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
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
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-xl md:text-2xl font-heading font-bold mb-8" style={{ color: 'var(--text-primary)' }}>
            {t['stats.title']}
          </h2>

          {error && (
            <div className="p-3 rounded-xl mb-6 text-sm" style={{ backgroundColor: '#ef444410', border: '1px solid #ef444420', color: '#ef4444' }}>
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Quadrant Distribution */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="glass p-6"
            >
              <h3 className="text-sm font-semibold mb-6 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                {t['stats.quadrantDist']}
              </h3>
              {quadrantData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={quadrantData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={45}
                      paddingAngle={4}
                      strokeWidth={0}
                      label={({ cx, cy, midAngle, outerRadius, name, value }: any) => {
                        const rad = Math.PI / 180 * midAngle
                        const x = cx + Math.cos(rad) * (outerRadius + 25)
                        const y = cy + Math.sin(rad) * (outerRadius + 25)
                        return (
                          <text x={x} y={y} fill="var(--text-secondary)" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11}>
                            {name}: {value}
                          </text>
                        )
                      }}
                      labelLine
                    >
                      {quadrantData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={QUADRANT_COLORS[entry.quadrant] || '#666'}
                          fillOpacity={0.9}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center py-16" style={{ color: 'var(--text-placeholder)' }}>{t['stats.noData']}</p>
              )}
            </motion.div>

            {/* Completion Rate */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="glass p-6"
            >
              <h3 className="text-sm font-semibold mb-6 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                {t['stats.completionRate']}
              </h3>
              <div className="flex flex-col items-center justify-center h-[300px]">
                <div className="relative w-44 h-44">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9155"
                      fill="none"
                      stroke="var(--border-subtle)"
                      strokeWidth="2"
                    />
                    <defs>
                      <linearGradient id="completionGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9155"
                      fill="none"
                      stroke="url(#completionGrad)"
                      strokeWidth="2.5"
                      strokeDasharray={`${completionRate}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.4 }}
                      className="text-4xl font-heading font-bold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {Math.round(completionRate)}%
                    </motion.span>
                    <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t['stats.completed']}</span>
                  </div>
                </div>
                <p className="text-sm mt-4" style={{ color: 'var(--text-muted)' }}>
                  {completionRate >= 80
                    ? t['stats.great']
                    : completionRate >= 50
                      ? t['stats.keepGoing']
                      : t['stats.moreToDo']}
                </p>
              </div>
            </motion.div>
          </div>

          {/* 7-Day Trends */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="glass p-6"
          >
            <h3 className="text-sm font-semibold mb-6 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              {t['stats.trends']}
            </h3>
            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis
                    dataKey="date"
                    stroke="var(--text-muted)"
                    tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="var(--text-muted)"
                    tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: 'var(--bg-primary)', stroke: '#3b82f6', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#3b82f6', stroke: 'var(--bg-primary)', strokeWidth: 2 }}
                    name="Tasks"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center py-16" style={{ color: 'var(--text-placeholder)' }}>{t['stats.noTrend']}</p>
            )}
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}
