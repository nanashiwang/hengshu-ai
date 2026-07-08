'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type EvidenceTargetType = 'skill_passport' | 'failure_case' | 'adapter_profile'

type EvidenceVerifyRow = {
  snapshot?: {
    id?: string
    targetType?: string
    targetId?: string
    evidenceHash?: string | null
    targetSummary?: Record<string, unknown> | null
    payloadHash?: string | null
    keyId?: string | null
    signature?: string | null
    signedAt?: string | null
    createdAt?: string | null
  }
  verify?: {
    status?: string
    reason?: string
    computedHash?: string | null
    hashValid?: boolean
    signatureValid?: boolean
    keyMatch?: boolean
  }
}

type EvidenceVerifyResult = {
  totalDocs?: number
  limit?: number
  publicKey?: { keyId: string; algorithm: string } | null
  docs?: EvidenceVerifyRow[]
  error?: string
}

const TARGET_LABELS: Record<EvidenceTargetType, string> = {
  skill_passport: 'Skill Passport',
  failure_case: 'FailureCase',
  adapter_profile: 'AdapterProfile',
}

const STATUS_LABELS: Record<string, string> = {
  valid: '签名有效',
  unsigned: '仅哈希',
  key_unavailable: '缺公钥',
  tampered: '异常',
}

function statusTone(status?: string) {
  if (status === 'valid') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  if (status === 'unsigned' || status === 'key_unavailable') return 'border-amber-500/30 bg-amber-500/10 text-amber-100'
  return 'border-red-500/30 bg-red-500/10 text-red-100'
}

function shortHash(value?: string | null, length = 18) {
  if (!value) return '—'
  return `${value.slice(0, length)}…`
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('zh-CN')
}

function stringifySummary(summary?: Record<string, unknown> | null) {
  if (!summary || typeof summary !== 'object') return '无公开摘要'
  return JSON.stringify(summary, null, 2)
}

function isEvidenceTargetType(value?: string): value is EvidenceTargetType {
  return value === 'skill_passport' || value === 'failure_case' || value === 'adapter_profile'
}

export function EvidenceVerifyForm({
  initialTargetType,
  initialTargetId = '',
  initialLimit = '20',
}: {
  initialTargetType?: string
  initialTargetId?: string
  initialLimit?: string
}) {
  const [targetType, setTargetType] = useState<EvidenceTargetType>(
    isEvidenceTargetType(initialTargetType) ? initialTargetType : 'skill_passport',
  )
  const [targetId, setTargetId] = useState(initialTargetId)
  const [limit, setLimit] = useState(initialLimit)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<EvidenceVerifyResult | null>(null)
  const autoSubmitted = useRef(false)

  const canSubmit = useMemo(() => targetId.trim().length > 0 && !pending, [targetId, pending])

  async function submit() {
    if (!canSubmit) return
    setPending(true)
    setResult(null)
    try {
      const params = new URLSearchParams({
        targetType,
        targetId: targetId.trim(),
        limit: limit.trim() || '20',
      })
      const response = await fetch(`/v1/evidence/verify?${params.toString()}`)
      const data = (await response.json()) as EvidenceVerifyResult
      setResult(data)
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : '证据验签请求失败' })
    } finally {
      setPending(false)
    }
  }

  useEffect(() => {
    if (autoSubmitted.current || !initialTargetId.trim()) return
    autoSubmitted.current = true
    void submit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--accent-2)]">Evidence Verifier</p>
          <h2 className="mt-1 text-xl font-semibold">证据快照在线验签</h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
            输入公开对象的 targetType 和 targetId，复核 Passport、失败案例或 Adapter 的 evidenceHash、payloadHash、ed25519 签名，并查看已脱敏 targetSummary。
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--muted)]">
          只允许公开对象验签，不能匿名枚举全量证据。
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[220px_1fr_120px]">
        <label className="space-y-1 text-xs text-[var(--muted)]">
          targetType
          <select
            value={targetType}
            onChange={(event) => setTargetType(event.target.value as EvidenceTargetType)}
            className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          >
            {Object.entries(TARGET_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-[var(--muted)]">
          targetId
          <input
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            placeholder="粘贴 Passport / FailureCase / Adapter 的 id"
            className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 font-mono text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
        </label>
        <label className="space-y-1 text-xs text-[var(--muted)]">
          limit
          <input
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            inputMode="numeric"
            className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? '验签中…' : '查询并验签'}
        </button>
        <p className="text-xs text-[var(--faint)]">也可直接调用 GET /v1/evidence/verify?targetType=...&targetId=... 接入外部审计。</p>
      </div>

      {result ? (
        <div className="mt-4 space-y-3">
          {result.error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
              查询失败：{result.error}
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 text-xs text-[var(--muted)]">
                当前公钥：
                {result.publicKey ? (
                  <span className="ml-1 font-mono text-[var(--text)]">{result.publicKey.keyId} · {result.publicKey.algorithm}</span>
                ) : (
                  <span className="ml-1 text-amber-200">未配置，结果只能做哈希校验</span>
                )}
                <span className="ml-3">命中 {result.totalDocs ?? 0} 条</span>
              </div>

              {result.docs?.length ? (
                <div className="space-y-3">
                  {result.docs.map((row, index) => {
                    const snapshot = row.snapshot || {}
                    const verify = row.verify || {}
                    const tone = statusTone(verify.status)
                    return (
                      <div key={snapshot.id || index} className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
                              {STATUS_LABELS[verify.status || ''] || verify.status || '未知'}
                            </span>
                            <span className="ml-2 text-xs text-[var(--muted)]">{verify.reason || '—'}</span>
                          </div>
                          <div className="text-xs text-[var(--faint)]">{formatDate(snapshot.signedAt || snapshot.createdAt)}</div>
                        </div>

                        <div className="mt-3 grid gap-2 text-xs text-[var(--muted)] md:grid-cols-2 lg:grid-cols-4">
                          <div>evidenceHash：<span className="font-mono text-[var(--text)]">{shortHash(snapshot.evidenceHash)}</span></div>
                          <div>payloadHash：<span className="font-mono text-[var(--text)]">{shortHash(snapshot.payloadHash)}</span></div>
                          <div>computedHash：<span className="font-mono text-[var(--text)]">{shortHash(verify.computedHash)}</span></div>
                          <div>keyId：<span className="font-mono text-[var(--text)]">{snapshot.keyId || '—'}</span></div>
                          <div>Hash：{verify.hashValid ? '有效' : '异常/未校验'}</div>
                          <div>签名：{verify.signatureValid ? '有效' : '未通过/未配置'}</div>
                          <div>Key：{verify.keyMatch ? '匹配' : '未匹配/未校验'}</div>
                          <div>目标：{snapshot.targetType || targetType}</div>
                        </div>

                        <div className="mt-3">
                          <div className="mb-1 text-xs font-semibold text-[var(--text)]">targetSummary（公开脱敏摘要）</div>
                          <pre className="max-h-72 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 text-xs text-[var(--muted)]">
                            {stringifySummary(snapshot.targetSummary)}
                          </pre>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
                  该对象暂无公开证据快照。
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
