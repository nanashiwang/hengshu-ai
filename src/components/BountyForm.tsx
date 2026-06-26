'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export function BountyForm({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', rewardPoints: '50', dueAt: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!loggedIn) {
    return (
      <p className="text-sm text-[var(--muted)]">
        <Link href="/login" className="text-[var(--accent)]">
          登录
        </Link>{' '}
        后可发布悬赏需求。
      </p>
    )
  }

  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/bounties', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          rewardType: 'points',
          rewardPoints: Number(form.rewardPoints) || 0,
          status: 'open',
          dueAt: form.dueAt || undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d?.errors?.[0]?.message || '发布失败')
        return
      }
      setForm({ title: '', description: '', rewardPoints: '50', dueAt: '' })
      setOpen(false)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
      >
        + 发布悬赏
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
      {error && <div className="text-sm text-[var(--danger)]">{error}</div>}
      <input
        value={form.title}
        onChange={(e) => set('title', e.target.value)}
        placeholder="悬赏标题，如：求小红书评论回复 Skill"
        className="w-full rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        required
      />
      <textarea
        value={form.description}
        onChange={(e) => set('description', e.target.value)}
        placeholder="需求说明、输入输出要求、验收标准…"
        rows={3}
        className="w-full rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      />
      <div className="flex gap-3">
        <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
          贡献值赏金
          <input
            type="number"
            value={form.rewardPoints}
            onChange={(e) => set('rewardPoints', e.target.value)}
            className="w-24 rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
          截止
          <input
            type="date"
            value={form.dueAt}
            onChange={(e) => set('dueAt', e.target.value)}
            className="rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1 text-sm"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          disabled={loading}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? '发布中…' : '发布'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[var(--border)] px-4 py-2 text-sm">
          取消
        </button>
      </div>
    </form>
  )
}
