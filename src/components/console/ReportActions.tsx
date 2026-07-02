'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ACTIONS = [
  { key: 'dismiss', label: '驳回', cls: 'border-[var(--border)]' },
  { key: 'resolve', label: '标记已解决', cls: 'border-[var(--border)]' },
  { key: 'hide_target', label: '隐藏内容', cls: 'border-[var(--warn)] text-[var(--warn)]' },
  { key: 'ban_target', label: '封禁责任人', cls: 'border-[var(--danger)] text-[var(--danger)]' },
] as const

export function ReportActions({ reportId }: { reportId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function handle(action: string) {
    if (loading) return
    if ((action === 'ban_target' || action === 'hide_target') && !confirm('确认执行此处置？')) return
    setLoading(action)
    setMsg(null)
    try {
      const res = await fetch(`/v1/reports/${reportId}/handle`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setMsg('已处置')
        router.refresh()
      } else {
        setMsg(data.error || '处置失败')
      }
    } catch (e: any) {
      setMsg(e.message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {ACTIONS.map((a) => (
        <button
          key={a.key}
          onClick={() => handle(a.key)}
          disabled={!!loading}
          className={`rounded border px-2.5 py-1 text-xs disabled:opacity-50 ${a.cls}`}
        >
          {loading === a.key ? '…' : a.label}
        </button>
      ))}
      {msg && <span className="text-xs text-[var(--muted)]">{msg}</span>}
    </div>
  )
}
