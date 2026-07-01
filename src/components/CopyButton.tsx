'use client'

import { useState } from 'react'

// 一键复制按钮：复制成功后内联显示"✓ 已复制"1.5s（轻量 toast 反馈）。
// 剪贴板 API 需 HTTPS/localhost；非安全上下文(HTTP 内网)回退到 execCommand，保证部署前本地可用。
export function CopyButton({
  value,
  label = '复制',
  className,
  title,
}: {
  value: string
  label?: string
  className?: string
  title?: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    let ok = false
    try {
      await navigator.clipboard.writeText(value)
      ok = true
    } catch {
      // 回退：非安全上下文或无权限时用隐藏 textarea + execCommand
      try {
        const ta = document.createElement('textarea')
        ta.value = value
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        ok = document.execCommand('copy')
        document.body.removeChild(ta)
      } catch {
        ok = false
      }
    }
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={title || '复制到剪贴板'}
      aria-label={title || '复制到剪贴板'}
      className={
        className ||
        'inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)]'
      }
    >
      {copied ? '✓ 已复制' : label}
    </button>
  )
}
