'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import zh, { type Translations } from './zh'
import en from './en'

type Lang = 'zh' | 'en'

interface LangContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: Translations
}

const LangContext = createContext<LangContextValue>({
  lang: 'zh',
  setLang: () => {},
  t: zh,
})

const STORAGE_KEY = 'ishwe_lang'

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('zh')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null
    if (saved === 'zh' || saved === 'en') {
      setLangState(saved)
    }
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem(STORAGE_KEY, l)
  }

  const t = lang === 'en' ? en : zh

  if (!mounted) {
    // Return a wrapper that hides content until mount to avoid hydration issues
    return <>{children}</>
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
