'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STATUSES = [
  { value: 'attributed', label: '已归因' },
  { value: 'needs_more_evidence', label: '证据不足' },
  { value: 'verified', label: '已复验' },
] as const

const ROOT_CAUSES = [
  { value: 'model_drift', label: '模型漂移' },
  { value: 'prompt_boundary', label: 'Prompt 边界' },
  { value: 'schema_mismatch', label: 'Schema 不匹配' },
  { value: 'adapter_gap', label: 'Adapter 缺口' },
  { value: 'data_quality', label: '数据/输入质量' },
  { value: 'unknown', label: '未知' },
] as const

export function FailureTriageActions({ failureId }: { failureId: string }) {
  const router = useRouter()
  const [triageStatus, setTriageStatus] = useState('attributed')
  const [rootCauseCategory, setRootCauseCategory] = useState('unknown')
  const [triageNotes, setTriageNotes] = useState('')
  const [targetRuns, setTargetRuns] = useState('')
  const [verifiedRuns, setVerifiedRuns] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function submit() {
    if (loading) return
    setLoading(true)
    setMsg(null)
    try {
      const verificationCoverage: Record<string, number> = {}
      for (const [key, value] of Object.entries({ targetRuns, verifiedRuns })) {
        const n = Number(value)
        if (Number.isFinite(n) && value.trim()) verificationCoverage[key] = n
      }
      const res = await fetch(`/v1/failures/${failureId}/triage`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triageStatus,
          rootCauseCategory,
          triageNotes,
          verificationCoverage,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setMsg('已更新')
        setTriageNotes('')
        router.refresh()
      } else {
        setMsg(data.error || '更新失败')
      }
    } catch (e: any) {
      setMsg(e.message || '更新失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          value={triageStatus}
          onChange={(event) => setTriageStatus(event.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--text)]"
        >
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select
          value={rootCauseCategory}
          onChange={(event) => setRootCauseCategory(event.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--text)]"
        >
          {ROOT_CAUSES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={targetRuns}
          onChange={(event) => setTargetRuns(event.target.value)}
          inputMode="numeric"
          placeholder="目标复验数"
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--text)]"
        />
        <input
          value={verifiedRuns}
          onChange={(event) => setVerifiedRuns(event.target.value)}
          inputMode="numeric"
          placeholder="已复验数"
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--text)]"
        />
      </div>
      <textarea
        value={triageNotes}
        onChange={(event) => setTriageNotes(event.target.value)}
        maxLength={1000}
        placeholder="归因备注（只写脱敏结论，不贴原始输入输出）"
        className="h-16 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="rounded border border-[var(--accent)] px-2.5 py-1 text-xs text-[var(--accent)] disabled:opacity-50"
        >
          {loading ? '…' : '保存归因'}
        </button>
        {msg && <span className="text-xs text-[var(--muted)]">{msg}</span>}
      </div>
    </div>
  )
}
