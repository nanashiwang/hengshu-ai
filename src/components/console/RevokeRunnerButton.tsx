'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function RevokeRunnerButton({ runnerId, label }: { runnerId: string; label?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function revoke() {
    if (loading) return
    const name = label ? `「${label}」` : '该 Runner'
    if (!window.confirm(`确定撤销 ${name}？撤销后本机需要重新登录。`)) return
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch(`/v1/runners/${runnerId}/revoke`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setErr(data.error || '撤销失败')
        return
      }
      router.refresh()
    } catch (e: any) {
      setErr(e.message || '撤销失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={revoke}
        disabled={loading}
        className="rounded border border-[var(--danger)] px-2 py-1 text-xs text-[var(--danger)] disabled:opacity-50"
      >
        {loading ? '撤销中…' : '撤销'}
      </button>
      {err && <span className="text-[11px] text-[var(--danger)]">{err}</span>}
    </span>
  )
}
