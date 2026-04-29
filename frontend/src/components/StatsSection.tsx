'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLang } from '@/i18n/LanguageContext'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line,
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
  if (!res.ok) throw new Error(`Error: ${res.status}`)
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

interface Props {
  selectedDate: string
  dateFilter: 'today' | 'all'
}

export default function StatsSection({ selectedDate, dateFilter }: Props) {
  const { t } = useLang()
  const [collapsed, setCollapsed] = useState(false)
  const [barData, setBarData] = useState<any[]>([])
  const [completionRate, setCompletionRate] = useState(0)
  const [completionLabel, setCompletionLabel] = useState('')
  const [trends, setTrends] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    setLoading(true)
    try {
      const dateParam = dateFilter === 'today' ? `?due_date=${selectedDate}` : ''
      const [quadrantRes, completionRes, trendsRes] = await Promise.all([
        apiFetch(`/stats/quadrant${dateParam}`),
        apiFetch(`/stats/completion${dateParam}`),
        apiFetch('/stats/trends?days=7'),
      ])

      const qMap = quadrantRes.data || {}
      const qLabels: Record<string, string> = {
        q1: t['quadrant.q1.label'] || 'Q1',
        q2: t['quadrant.q2.label'] || 'Q2',
        q3: t['quadrant.q3.label'] || 'Q3',
        q4: t['quadrant.q4.label'] || 'Q4',
      }
      const bars = ['q1', 'q2', 'q3', 'q4'].map(q => ({
        name: qLabels[q],
        value: qMap[q] || 0,
        quadrant: q,
      }))
      setBarData(bars)

      const compData = completionRes.data || {}
      setCompletionRate(compData.rate ?? 0)
      const completed = compData.completed ?? 0
      const total = compData.total ?? 0
      setCompletionLabel(`${completed}/${total}`)

      setTrends(trendsRes.data || [])
    } catch {
      // ignore errors — show empty state
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [dateFilter, selectedDate])

  const rateMsg =
    completionRate >= 80 ? t['stats.great']
    : completionRate >= 50 ? t['stats.keepGoing']
    : t['stats.moreToDo']

  return (
    <section className="mt-8">
      {/* Header with toggle and collapse */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-heading font-bold" style={{ color: 'var(--text-primary)' }}>
          {t['stats.title']}
        </h3>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-200 hover:shadow-sm max-md:hidden"
          style={{
            color: 'var(--text-secondary)',
            borderColor: 'var(--border-medium)',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          {collapsed ? (
            <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg> {t['stats.toggleExpand']}</>
          ) : (
            <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 15l-6-6-6 6"/></svg> {t['stats.toggleCollapse']}</>
          )}
        </button>
      </div>

      {/* Mobile collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="md:hidden w-full flex items-center justify-center gap-1.5 text-center py-2 text-xs mb-3 rounded-lg border transition-all duration-200"
        style={{
          color: 'var(--text-secondary)',
          borderColor: 'var(--border-medium)',
          backgroundColor: 'var(--bg-card)',
        }}
      >
        {collapsed ? (
          <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg> {t['stats.toggleExpand']}</>
        ) : (
          <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 15l-6-6-6 6"/></svg> {t['stats.toggleCollapse']}</>
        )}
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {loading ? (
              <div className="flex items-center justify-center py-16" style={{ color: 'var(--text-muted)' }}>
                <div className="w-2 h-2 rounded-full animate-pulse mr-2" style={{ backgroundColor: 'var(--neon-blue)' }} />
                <span className="text-xs font-mono">{t['dashboard.loading']}</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Quadrant Bar Chart */}
                <div className="glass p-5">
                  <h4 className="text-xs font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    {t['stats.quadrantDist']}
                  </h4>
                  {barData.some(d => d.value > 0) ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                        <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                        <YAxis allowDecimals={false} stroke="var(--text-muted)" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                          {barData.map((entry, index) => (
                            <Cell key={index} fill={QUADRANT_COLORS[entry.quadrant] || '#666'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center py-20 text-xs" style={{ color: 'var(--text-placeholder)' }}>{t['stats.noData']}</p>
                  )}
                </div>

                {/* Completion Rate */}
                <div className="glass p-5">
                  <h4 className="text-xs font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    {t['stats.completionRate']}
                  </h4>
                  <div className="flex flex-col items-center justify-center" style={{ height: 260 }}>
                    <div className="relative w-36 h-36">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--border-subtle)" strokeWidth="2" />
                        <defs>
                          <linearGradient id="completionGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#8b5cf6" />
                          </linearGradient>
                        </defs>
                        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="url(#completionGrad2)"
                          strokeWidth="2.5" strokeDasharray={`${completionRate}, 100`} strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-heading font-bold" style={{ color: 'var(--text-primary)' }}>
                          {Math.round(completionRate)}%
                        </span>
                        <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{completionLabel}</span>
                      </div>
                    </div>
                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{rateMsg}</p>
                  </div>
                </div>

                {/* 7-Day Trends */}
                <div className="glass p-5 md:col-span-2">
                  <h4 className="text-xs font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    {t['stats.trends']}
                  </h4>
                  {trends.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={trends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                        <XAxis dataKey="date" stroke="var(--text-muted)" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                        <YAxis allowDecimals={false} stroke="var(--text-muted)" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2.5}
                          dot={{ r: 3, fill: 'var(--bg-primary)', stroke: '#3b82f6', strokeWidth: 2 }}
                          activeDot={{ r: 5, fill: '#3b82f6', stroke: 'var(--bg-primary)', strokeWidth: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center py-16 text-xs" style={{ color: 'var(--text-placeholder)' }}>{t['stats.noTrend']}</p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
