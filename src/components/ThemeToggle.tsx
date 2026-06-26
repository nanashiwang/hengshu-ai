'use client'

import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = (document.documentElement.getAttribute('data-theme') as Theme) || 'dark'
    setTheme(t)
    setMounted(true)
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem('skillhub-theme', next)
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label="切换浅色/深色主题"
      title={theme === 'dark' ? '切换到浅色' : '切换到深色'}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)]"
    >
      {/* 避免 hydration 不一致：未挂载前用占位 */}
      <span suppressHydrationWarning>{mounted ? (theme === 'dark' ? '☀️' : '🌙') : '◐'}</span>
    </button>
  )
}
