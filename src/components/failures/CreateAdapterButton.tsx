'use client'

import Link from 'next/link'
import { useState } from 'react'

export function CreateAdapterButton({ failureId }: { failureId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [adapterId, setAdapterId] = useState<string | null>(null)

  async function createDraft() {
    setState('loading')
    setMessage('')
    setAdapterId(null)
    const res = await fetch(`/v1/failures/${failureId}/adapter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setState('error')
      setMessage(data.error || '生成失败')
      return
    }
    setState('done')
    setAdapterId(data.adapter?.id ? String(data.adapter.id) : null)
    setMessage('已生成 Adapter 草稿，下一步审核补丁内容、启用后跑 benchmark 复验 lift。')
  }

  return (
    <div className="mt-3 text-xs">
      <button
        type="button"
        onClick={createDraft}
        disabled={state === 'loading' || state === 'done'}
        className="rounded-full border border-[var(--border)] bg-[var(--panel-2)] px-3 py-1 text-[var(--text)] hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === 'loading' ? '生成中...' : state === 'done' ? '已生成 Adapter 草稿' : '从此失败生成 Adapter 草稿'}
      </button>
      {message && (
        <span className={state === 'error' ? 'ml-2 text-red-500' : 'ml-2 text-[var(--muted)]'}>{message}</span>
      )}
      {adapterId && (
        <Link href={`/admin/collections/adapter-profiles/${adapterId}`} className="ml-2 text-[var(--accent)] hover:underline" target="_blank">
          打开草稿
        </Link>
      )}
    </div>
  )
}
