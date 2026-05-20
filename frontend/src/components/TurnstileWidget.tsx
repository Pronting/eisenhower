'use client'

import { useEffect, useRef, useCallback } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      remove: (id: string) => void
    }
  }
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

export default function TurnstileWidget({ onVerify }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile || !SITE_KEY) return
    // Clean up previous instance
    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current)
    }
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: (token: string) => onVerify(token),
    })
  }, [onVerify])

  useEffect(() => {
    if (!SITE_KEY) return
    // If turnstile is already loaded, render immediately
    if (window.turnstile) {
      renderWidget()
      return
    }
    // Poll until turnstile script loads (injected in layout.tsx)
    const interval = setInterval(() => {
      if (window.turnstile) {
        clearInterval(interval)
        renderWidget()
      }
    }, 200)
    return () => clearInterval(interval)
  }, [renderWidget])

  // If no site key configured, skip rendering (dev environment)
  if (!SITE_KEY) return null

  return <div ref={containerRef} className="my-4" />
}
