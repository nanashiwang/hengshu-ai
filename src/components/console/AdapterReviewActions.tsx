'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ACTIONS = [
  { reviewStatus: 'approved', label: '批准并启用', activate: true, cls: 'border-emerald-400 text-emerald-300' },
  { reviewStatus: 'needs_changes', label: '需修改', activate: false, cls: 'border-amber-400 text-amber-300' },
  { reviewStatus: 'rejected', label: '拒绝', activate: false, cls: 'border-red-400 text-red-300' },
] as const

export function AdapterReviewActions({ adapterId }: { adapterId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  async function submit(reviewStatus: string, activate: boolean) {
    if (loading) return
    if (reviewStatus === 'approved' && !confirm('确认批准并启用这个 Adapter？')) return
    setLoading(reviewStatus)
    setMsg(null)
    try {
      const res = await fetch(`/v1/adapters/${adapterId}/review`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewStatus, activate, reviewerNotes: notes }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setMsg('已更新')
        setNotes('')
        router.refresh()
      } else {
        setMsg(data.error || '更新失败')
      }
    } catch (e: any) {
      setMsg(e.message || '更新失败')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        maxLength={1000}
        placeholder="评审备注（可选，不填写补丁正文或用户输入输出）"
        className="h-16 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
      />
      <div className="flex flex-wrap items-center gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.reviewStatus}
            type="button"
            disabled={!!loading}
            onClick={() => submit(a.reviewStatus, a.activate)}
            className={`rounded border px-2.5 py-1 text-xs disabled:opacity-50 ${a.cls}`}
          >
            {loading === a.reviewStatus ? '…' : a.label}
          </button>
        ))}
        {msg && <span className="text-xs text-[var(--muted)]">{msg}</span>}
      </div>
    </div>
  )
}
