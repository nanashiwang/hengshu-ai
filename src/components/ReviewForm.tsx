'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export function ReviewForm({ skillId, loggedIn }: { skillId: string; loggedIn: boolean }) {
  const router = useRouter()
  const [rating, setRating] = useState(5)
  const [content, setContent] = useState('')
  const [type, setType] = useState('review')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!loggedIn) {
    return (
      <p className="text-sm text-[var(--muted)]">
        <Link href="/login" className="text-[var(--accent)]">
          登录
        </Link>{' '}
        后可发表评价与失败案例。
      </p>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill: skillId, rating, content, type }),
      })
      if (!res.ok) {
        const raw = await res.text().catch(() => '')
        if (/duplicate|unique|已存在|唯一/i.test(raw)) {
          setError('你已对该 Skill 发表过同类型评价，请先编辑或删除原评价')
        } else {
          let msg = '提交失败'
          try {
            msg = JSON.parse(raw)?.errors?.[0]?.message || msg
          } catch {
            /* 非 JSON 响应，用默认文案 */
          }
          setError(msg)
        }
        return
      }
      setContent('')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="mb-4 space-y-2 rounded-lg border border-[var(--border)] p-3">
      {error && <div className="text-xs text-[var(--danger)]">{error}</div>}
      <div className="flex items-center gap-3 text-sm">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1 text-xs"
        >
          <option value="review">评价</option>
          <option value="failure_case">失败案例</option>
          <option value="compat_report">兼容报告</option>
        </select>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => setRating(n)}
              className={n <= rating ? 'text-[var(--warn)]' : 'text-[var(--muted)]'}
            >
              ★
            </button>
          ))}
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={2}
        placeholder="分享你的使用体验…"
        className="w-full rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      />
      <button
        disabled={loading}
        className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? '提交中…' : '发表'}
      </button>
    </form>
  )
}
