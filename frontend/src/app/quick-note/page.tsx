'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import QuickNote from '@/components/QuickNote'
import { hasValidToken } from '@/lib/desktop-auth'

export default function QuickNotePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to desktop-login if not authenticated
    if (!hasValidToken()) {
      router.push('/desktop-login')
    }
  }, [router])

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <QuickNote />
    </div>
  )
}
