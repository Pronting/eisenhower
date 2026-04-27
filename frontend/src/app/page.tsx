'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useLang } from '@/i18n/LanguageContext'
import ThemeToggle from '@/components/ThemeToggle'

const floatingOrbs = [
  { color: '#3b82f6', size: 400, x: '5%', y: '10%', delay: 0 },
  { color: '#8b5cf6', size: 300, x: '75%', y: '55%', delay: 2 },
  { color: '#ef4444', size: 350, x: '55%', y: '8%', delay: 4 },
  { color: '#f59e0b', size: 250, x: '25%', y: '65%', delay: 1 },
]

const quadrants = [
  { id: 'q1', labelKey: 'quadrant.q1.label', descKey: 'quadrant.q1.desc', color: '#ef4444', glow: 'glow-q1', icon: '⚡' },
  { id: 'q2', labelKey: 'quadrant.q2.label', descKey: 'quadrant.q2.desc', color: '#f59e0b', glow: 'glow-q2', icon: '🎯' },
  { id: 'q3', labelKey: 'quadrant.q3.label', descKey: 'quadrant.q3.desc', color: '#3b82f6', glow: 'glow-q3', icon: '📤' },
  { id: 'q4', labelKey: 'quadrant.q4.label', descKey: 'quadrant.q4.desc', color: '#8b5cf6', glow: 'glow-q4', icon: '🗑' },
]

const painPoints = [
  { icon: '😰', titleKey: 'landing.pain.1.title', descKey: 'landing.pain.1.desc' },
  { icon: '⏰', titleKey: 'landing.pain.2.title', descKey: 'landing.pain.2.desc' },
  { icon: '🤯', titleKey: 'landing.pain.3.title', descKey: 'landing.pain.3.desc' },
  { icon: '🎲', titleKey: 'landing.pain.4.title', descKey: 'landing.pain.4.desc' },
]

const features = [
  { icon: '🤖', titleKey: 'landing.features.ai.title', descKey: 'landing.features.ai.desc' },
  { icon: '↔️', titleKey: 'landing.features.drag.title', descKey: 'landing.features.drag.desc' },
  { icon: '📬', titleKey: 'landing.features.push.title', descKey: 'landing.features.push.desc' },
  { icon: '📊', titleKey: 'landing.features.analysis.title', descKey: 'landing.features.analysis.desc' },
  { icon: '🎨', titleKey: 'landing.features.theme.title', descKey: 'landing.features.theme.desc' },
  { icon: '🌐', titleKey: 'landing.features.i18n.title', descKey: 'landing.features.i18n.desc' },
]

const comparisonRows = [
  { featureKey: 'landing.compare.ai', ishwe: true, notion: false, excel: false },
  { featureKey: 'landing.compare.drag', ishwe: true, notion: true, excel: false },
  { featureKey: 'landing.compare.push', ishwe: true, notion: false, excel: false },
  { featureKey: 'landing.compare.theme', ishwe: true, notion: true, excel: false },
  { featureKey: 'landing.compare.i18n', ishwe: true, notion: false, excel: false },
]

export default function LandingPage() {
  const [mounted, setMounted] = useState(false)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const { t } = useLang()
  useEffect(() => {
    setMounted(true)
    // Check login state
    const token = localStorage.getItem('token')
    const user = localStorage.getItem('user')
    setIsLoggedIn(!!(token && user))
  }, [])

  // Carousel auto-advance
  useEffect(() => {
    const timer = setInterval(() => {
      setCarouselIndex(prev => (prev + 1) % features.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  if (!mounted) return null

  return (
    <div className="relative overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* ===== TOP NAV ===== */}
      <nav
        className="sticky top-0 z-50 border-b backdrop-blur-xl"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <span className="text-xl font-heading font-bold gradient-text">ishwe</span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-300 hover:shadow-md"
                style={{
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--bg-primary)',
                }}
              >
                {t['landing.cta.dashboard']}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {t['landing.cta.login']}
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-300 hover:shadow-md"
                  style={{
                    backgroundColor: 'var(--text-primary)',
                    color: 'var(--bg-primary)',
                  }}
                >
                  {t['landing.cta.start']}
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Animated grid background */}
      <div className="fixed inset-0 bg-grid-animated pointer-events-none" style={{ opacity: 0.4 }} />

      {/* Floating orbs */}
      {floatingOrbs.map((orb, i) => (
        <motion.div
          key={i}
          className="fixed rounded-full pointer-events-none"
          style={{
            left: orb.x,
            top: orb.y,
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle, ${orb.color}08 0%, transparent 70%)`,
            filter: 'blur(80px)',
          }}
          animate={{ x: [0, 40, -30, 0], y: [0, -30, 40, 0], scale: [1, 1.08, 0.95, 1] }}
          transition={{ duration: 14, delay: orb.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* Content */}
      <div className="relative z-10">
        {/* ===== HERO ===== */}
        <section className="flex flex-col items-center justify-center min-h-screen px-4 pt-20 pb-16">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <span
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-mono tracking-wider uppercase"
              style={{ borderColor: 'var(--border-medium)', color: 'var(--text-muted)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
              {t['landing.badge']}
            </span>
          </motion.div>

          {/* Hero Text */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl lg:text-8xl font-heading font-bold text-center mb-6 tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {t['landing.heroTitle1']}
            <br />
            <span className="gradient-text">{t['landing.heroTitle2']}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-lg md:text-xl text-center max-w-xl mb-10 text-balance"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t['landing.heroSubtitle']}
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="flex flex-col sm:flex-row gap-4 items-center mb-16"
          >
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="group relative px-8 py-3 rounded-xl font-semibold transition-all duration-300 hover:shadow-lg"
                style={{
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--bg-primary)',
                }}
              >
                <span className="relative z-10">{t['landing.cta.dashboard']}</span>
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="group relative px-8 py-3 rounded-xl font-semibold transition-all duration-300 hover:shadow-lg"
                  style={{
                    backgroundColor: 'var(--text-primary)',
                    color: 'var(--bg-primary)',
                  }}
                >
                  <span className="relative z-10">{t['landing.cta.start']}</span>
                </Link>
                <Link
                  href="/login"
                  className="px-8 py-3 rounded-xl font-medium transition-all duration-300 border"
                  style={{
                    color: 'var(--text-secondary)',
                    borderColor: 'var(--border-medium)',
                  }}
                >
                  {t['landing.cta.login']}
                </Link>
              </>
            )}
          </motion.div>

          {/* Quadrant mini preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="grid grid-cols-2 gap-3 max-w-2xl w-full"
          >
            {quadrants.map((q, i) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.7 + i * 0.1 }}
                className={`glass-sm p-4 md:p-5 hover:scale-[1.02] transition-all duration-500 ${q.glow}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{q.icon}</span>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: q.color }}>
                    {t[q.labelKey]}
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t[q.descKey]}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ===== DEMO ANIMATION ===== */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-3xl md:text-4xl font-heading font-bold text-center mb-12"
              style={{ color: 'var(--text-primary)' }}
            >
              {t['landing.demo.title']}
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: '✍️', step: '01', titleKey: 'landing.demo.step1.title', descKey: 'landing.demo.step1.desc', color: '#3b82f6' },
                { icon: '📊', step: '02', titleKey: 'landing.demo.step2.title', descKey: 'landing.demo.step2.desc', color: '#8b5cf6' },
                { icon: '✅', step: '03', titleKey: 'landing.demo.step3.title', descKey: 'landing.demo.step3.desc', color: '#22c55e' },
              ].map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.15 }}
                  className="glass-sm p-6 text-center relative overflow-hidden group hover:scale-[1.03] transition-transform duration-500"
                >
                  {/* Step number bg */}
                  <span
                    className="absolute -top-4 -right-4 text-8xl font-heading font-bold opacity-[0.04] select-none"
                    style={{ color: step.color }}
                  >
                    {step.step}
                  </span>
                  <motion.span
                    className="text-4xl mb-4 block"
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3, delay: i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    {step.icon}
                  </motion.span>
                  <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                    {t[step.titleKey]}
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {t[step.descKey]}
                  </p>
                  {/* Animated connector line */}
                  {i < 2 && (
                    <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                      <motion.svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                        animate={{ x: [0, 6, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <path d="M9 18l6-6-6-6" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </motion.svg>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== PAIN POINTS ===== */}
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-3xl md:text-4xl font-heading font-bold text-center mb-12"
              style={{ color: 'var(--text-primary)' }}
            >
              {t['landing.pain.title']}
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {painPoints.map((point, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="glass-sm p-5"
                >
                  <span className="text-2xl mb-2 block">{point.icon}</span>
                  <h3 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                    {t[point.titleKey]}
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {t[point.descKey]}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== SCIENCE ===== */}
        <section className="py-20 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div className="max-w-4xl mx-auto">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-3xl md:text-4xl font-heading font-bold text-center mb-4"
              style={{ color: 'var(--text-primary)' }}
            >
              {t['landing.science.title']}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-center mb-10 text-sm max-w-2xl mx-auto"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t['landing.science.subtitle']}
            </motion.p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
              {quadrants.map((q, i) => (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className={`glass-sm p-5 ${q.glow}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{q.icon}</span>
                    <h4 className="font-bold text-sm" style={{ color: q.color }}>
                      {t[`landing.science.${q.id}.title`]}
                    </h4>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {t[`landing.science.${q.id}.desc`]}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Research data stats */}
            <motion.h3
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="text-lg font-heading font-bold text-center mb-8"
              style={{ color: 'var(--text-primary)' }}
            >
              {t['landing.science.stats.title']}
            </motion.h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((n, i) => (
                <motion.div
                  key={n}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
                  className="glass-sm p-4 text-center group hover:scale-105 transition-transform duration-300"
                >
                  <div
                    className="text-2xl md:text-3xl font-heading font-bold mb-1 group-hover:scale-110 transition-transform duration-300"
                    style={{ color: `var(--neon-${n % 2 === 0 ? 'blue' : 'green'})` }}
                  >
                    {t[`landing.science.stats.${n}.value`]}
                  </div>
                  <div
                    className="text-xs font-semibold mb-2 uppercase tracking-wider"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {t[`landing.science.stats.${n}.label`]}
                  </div>
                  <div className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {t[`landing.science.stats.${n}.desc`]}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== FEATURES ===== */}
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-3xl md:text-4xl font-heading font-bold text-center mb-12"
              style={{ color: 'var(--text-primary)' }}
            >
              {t['landing.features.title']}
            </motion.h2>
            <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((feat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="glass-sm p-5 hover:scale-[1.02] transition-transform duration-300"
                >
                  <span className="text-2xl mb-3 block">{feat.icon}</span>
                  <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
                    {t[feat.titleKey]}
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {t[feat.descKey]}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Mobile carousel */}
            <div className="sm:hidden relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={carouselIndex}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.35 }}
                  className="glass-sm p-6 text-center"
                >
                  <span className="text-3xl mb-3 block">{features[carouselIndex].icon}</span>
                  <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--text-primary)' }}>
                    {t[features[carouselIndex].titleKey]}
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {t[features[carouselIndex].descKey]}
                  </p>
                </motion.div>
              </AnimatePresence>
              <div className="flex justify-center gap-2 mt-5">
                {features.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCarouselIndex(i)}
                    className="w-2 h-2 rounded-full transition-all duration-300"
                    style={{
                      backgroundColor: i === carouselIndex ? 'var(--neon-blue)' : 'var(--border-medium)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ===== COMPARISON ===== */}
        <section className="py-20 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div className="max-w-3xl mx-auto">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-3xl md:text-4xl font-heading font-bold text-center mb-12"
              style={{ color: 'var(--text-primary)' }}
            >
              {t['landing.compare.title']}
            </motion.h2>
            <div className="glass overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-medium)' }}>
                    <th className="text-left p-4 font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {t['landing.compare.col.feature']}
                    </th>
                    <th className="text-center p-4 font-bold" style={{ color: '#3b82f6' }}>
                      {t['landing.compare.col.ishwe']}
                    </th>
                    <th className="text-center p-4 font-semibold" style={{ color: 'var(--text-muted)' }}>
                      {t['landing.compare.col.notion']}
                    </th>
                    <th className="text-center p-4 font-semibold" style={{ color: 'var(--text-muted)' }}>
                      {t['landing.compare.col.excel']}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="p-4" style={{ color: 'var(--text-secondary)' }}>
                        {t[row.featureKey]}
                      </td>
                      <td className="text-center p-4 text-neon-green font-bold">✓</td>
                      <td className="text-center p-4" style={{ color: 'var(--text-muted)' }}>
                        {row.notion ? '✓' : '—'}
                      </td>
                      <td className="text-center p-4" style={{ color: 'var(--text-muted)' }}>
                        {row.excel ? '✓' : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="p-4" style={{ color: 'var(--text-secondary)' }}>
                      {t['landing.compare.ux']}
                    </td>
                    <td className="text-center p-4 text-sm" style={{ color: '#3b82f6' }}>
                      {t['landing.compare.ux.ishwe']}
                    </td>
                    <td className="text-center p-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {t['landing.compare.ux.notion']}
                    </td>
                    <td className="text-center p-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {t['landing.compare.ux.excel']}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-4 font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {t['landing.compare.verdict']}
                    </td>
                    <td className="text-center p-4 text-xs" style={{ color: '#3b82f6' }}>
                      {t['landing.compare.verdict.ishwe']}
                    </td>
                    <td className="text-center p-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {t['landing.compare.verdict.notion']}
                    </td>
                    <td className="text-center p-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {t['landing.compare.verdict.excel']}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ===== CTA BOTTOM ===== */}
        <section className="py-24 px-4 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-5xl font-heading font-bold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            {t['landing.ctaBottom.title']}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-8"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t['landing.ctaBottom.subtitle']}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Link
              href="/register"
              className="inline-block px-10 py-4 rounded-xl font-bold text-lg transition-all duration-300 hover:shadow-lg hover:scale-105"
              style={{
                backgroundColor: 'var(--text-primary)',
                color: 'var(--bg-primary)',
              }}
            >
              {t['landing.ctaBottom.button']}
            </Link>
          </motion.div>
        </section>

        {/* ===== FOOTER ===== */}
        <footer className="py-8 px-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm font-heading font-bold gradient-text">ishwe</span>
            <div className="flex items-center gap-6 text-xs" style={{ color: 'var(--text-muted)' }}>
              <a
                href="https://github.com/Pronting/eisenhower"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {t['landing.footer.github']}
              </a>
              <span>{t['landing.footer.copyright']}</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
