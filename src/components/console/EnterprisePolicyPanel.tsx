'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Registry = {
  id: string
  name?: string
  organization: string
  skill: string
  skillSlug?: string
  skillTitle: string
  approvalStatus?: string
  auditPolicy?: any
}

type CertificateSummary = {
  status?: string
  statusReasons?: string[]
  certificateHash?: string
  signed?: boolean
}

type Template = {
  key: string
  label: string
  description: string
  policy: Record<string, unknown>
}

const certificateReasonLabels: Record<string, string> = {
  passport_revoked: 'Passport 已撤销',
  skill_rejected: 'Skill 已驳回',
  passport_not_current: 'Passport 还不是当前状态',
  skill_not_verified: 'Skill 尚未进入 verified 档',
  manifest_not_signed: 'manifest 还没有有效签名',
  trust_score_low: 'Passport 可信分不足 60',
  benchmark_missing: '缺少黄金样例基准',
  benchmark_failed: '黄金样例未全部通过',
  evidence_snapshot_missing: '缺少可验签证据快照',
  evidence_snapshot_invalid: '证据快照验签未通过',
  certificate_check_failed: '证书状态检查失败',
}

function certificateStatusLabel(status?: string) {
  if (status === 'passed') return '正式达标'
  if (status === 'provisional') return '预备状态'
  if (status === 'failed') return '未达标'
  return '未知状态'
}

function certificateReasonLabel(reason: string) {
  return certificateReasonLabels[reason] || reason
}

export function EnterprisePolicyPanel({
  registries,
  templates,
}: {
  registries: Registry[]
  templates: Template[]
}) {
  const router = useRouter()
  const [rows, setRows] = useState(registries)
  const [selected, setSelected] = useState(registries[0]?.id || '')
  const registry = rows.find((r) => r.id === selected)
  const [template, setTemplate] = useState(templates[0]?.key || '')
  const [maxInputChars, setMaxInputChars] = useState('')
  const [requireByok, setRequireByok] = useState(false)
  const [riskAccepted, setRiskAccepted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [certificateSummary, setCertificateSummary] =
    useState<CertificateSummary | null>(null)
  const [certificateLoading, setCertificateLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  )
  const certificateUnknown = !certificateLoading && !certificateSummary
  const certificateRiskRequired =
    certificateUnknown ||
    (!!certificateSummary && certificateSummary.status !== 'passed')

  useEffect(() => {
    setRows(registries)
    setSelected((current) =>
      registries.some((r) => r.id === current)
        ? current
        : registries[0]?.id || '',
    )
  }, [registries])

  useEffect(() => {
    const policy = registry?.auditPolicy || {}
    const max = Number(policy.maxInputChars ?? policy.max_input_chars)
    setMaxInputChars(Number.isFinite(max) && max > 0 ? String(max) : '')
    setRequireByok(policy.requireByok === true)
    setRiskAccepted(false)
    setMsg(null)
  }, [registry?.id])

  useEffect(() => {
    if (!registry?.id) {
      setCertificateSummary(null)
      return
    }
    let cancelled = false
    setCertificateLoading(true)
    fetch(`/v1/enterprise/registry/${registry.id}/passport`, {
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          setCertificateSummary(data?.registry?.certificateSummary || null)
        }
      })
      .catch(() => {
        if (!cancelled) setCertificateSummary(null)
      })
      .finally(() => {
        if (!cancelled) setCertificateLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [registry?.id])

  async function save() {
    if (!registry || saving) return
    setSaving(true)
    setMsg(null)
    const auditPolicy: Record<string, unknown> = {}
    const n = Number(maxInputChars)
    if (Number.isFinite(n) && n > 0) auditPolicy.maxInputChars = Math.floor(n)
    if (requireByok) auditPolicy.requireByok = true

    try {
      const res = await fetch('/v1/enterprise/registry', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registryId: registry.id,
          organizationId: registry.organization,
          skillId: registry.skill,
          approvalStatus: registry.approvalStatus || 'approved',
          policyTemplate: template,
          auditPolicy,
          certificateRiskAccepted: riskAccepted,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setMsg({ type: 'err', text: data.error || '保存失败' })
        return
      }
      setRows((prev) =>
        prev.map((row) =>
          row.id === registry.id
            ? {
                ...row,
                approvalStatus:
                  data.registry?.approvalStatus || row.approvalStatus,
                auditPolicy: data.registry?.auditPolicy ?? row.auditPolicy,
              }
            : row,
        ),
      )
      if (data.certificateSummary) setCertificateSummary(data.certificateSummary)
      setRiskAccepted(false)
      setMsg({ type: 'ok', text: '策略包已保存，后续企业运行会按新规则拦截。' })
      router.refresh()
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message || '保存失败' })
    } finally {
      setSaving(false)
    }
  }

  if (rows.length === 0)
    return (
      <div className="text-sm text-[var(--muted)]">
        暂无企业 Registry，请先在后台批准一个 Skill。
      </div>
    )

  return (
    <div className="space-y-4 text-sm">
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">
          企业 Skill
        </label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 outline-none focus:border-[var(--accent)]"
        >
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.skillTitle} · {r.approvalStatus || 'pending'}
            </option>
          ))}
        </select>
      </div>

      {registry && (
        <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-3 text-xs">
          <div className="flex flex-wrap gap-2">
            {registry.skillSlug ? (
              <a
                href={`/skills/${registry.skillSlug}/run?organizationId=${encodeURIComponent(registry.organization)}`}
                className="rounded-full border border-emerald-500/40 px-3 py-1 text-emerald-200 hover:border-emerald-300"
              >
                组织上下文试跑
              </a>
            ) : null}
            <a
              href={`/v1/enterprise/registry/${registry.id}/passport`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[var(--border)] px-3 py-1 text-[var(--accent)] hover:border-[var(--accent)]"
            >
              组织内 Passport / 证书状态
            </a>
            <a
              href={`/v1/enterprise/registry/${registry.id}/evidence-package`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[var(--border)] px-3 py-1 text-[var(--accent)] hover:border-[var(--accent)]"
            >
              导出证据包
            </a>
            <a
              href={`/v1/enterprise/audit/export?organizationId=${encodeURIComponent(registry.organization)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[var(--border)] px-3 py-1 text-[var(--accent)] hover:border-[var(--accent)]"
            >
              导出审计 CSV
            </a>
            <a
              href={`/v1/enterprise/failures?organizationId=${encodeURIComponent(registry.organization)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[var(--border)] px-3 py-1 text-[var(--accent)] hover:border-[var(--accent)]"
            >
              组织失败知识库
            </a>
          </div>
          <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3">
            <div className="font-medium text-[var(--text)]">证书状态</div>
            {certificateLoading ? (
              <p className="mt-1 text-[var(--muted)]">读取中...</p>
            ) : certificateSummary ? (
              <div className="mt-1 space-y-1 text-[var(--muted)]">
                <p>
                  {certificateStatusLabel(certificateSummary.status)}
                  {certificateSummary.signed ? ' · 已签名' : ' · 未签名'}
                </p>
                {certificateSummary.statusReasons?.length ? (
                  <p>
                    原因：
                    {certificateSummary.statusReasons
                      .map(certificateReasonLabel)
                      .join(' / ')}
                  </p>
                ) : null}
                {certificateSummary.status !== 'passed' ? (
                  <p className="text-amber-200">
                    建议先不要正式批准；如需灰度，只应配合低风险策略、模型白名单和审计导出。
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-1 text-[var(--muted)]">
                暂无证书摘要；请先生成 Passport 或打开接口查看详情。
              </p>
            )}
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">
          策略模板
        </label>
        <select
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 outline-none focus:border-[var(--accent)]"
        >
          {templates.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-3 text-xs text-[var(--muted)]">
          {templates.find((t) => t.key === template)?.description ||
            '选择一个策略模板'}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--muted)]">
            覆盖输入长度上限
          </span>
          <input
            value={maxInputChars}
            onChange={(e) => setMaxInputChars(e.target.value)}
            placeholder="例如 8000"
            inputMode="numeric"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 outline-none focus:border-[var(--accent)]"
          />
        </label>
        <label className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2">
          <input
            type="checkbox"
            checked={requireByok}
            onChange={(e) => setRequireByok(e.target.checked)}
          />
          <span>强制 BYOK</span>
        </label>
      </div>

      {certificateRiskRequired ? (
        <label className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <input
            type="checkbox"
            checked={riskAccepted}
            onChange={(e) => setRiskAccepted(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            我已看到该 Skill
            {certificateSummary
              ? ` 仍是${certificateStatusLabel(certificateSummary.status)}`
              : ' 暂无可确认的证书摘要'}
            ，确认只做企业内灰度/限制使用，并接受证书未正式达标的风险。
          </span>
        </label>
      ) : null}

      {registry?.auditPolicy && (
        <details className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-3 text-xs">
          <summary className="cursor-pointer text-[var(--muted)]">
            当前策略 JSON
          </summary>
          <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words">
            {JSON.stringify(registry.auditPolicy, null, 2)}
          </pre>
        </details>
      )}

      <button
        onClick={save}
        disabled={
          saving ||
          !registry ||
          certificateLoading ||
          (certificateRiskRequired && !riskAccepted)
        }
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving
          ? '保存中...'
          : certificateSummary?.status === 'passed'
            ? '保存策略包'
            : '确认风险并保存策略包'}
      </button>
      {msg && (
        <span
          className={
            msg.type === 'ok'
              ? 'ml-3 text-[var(--accent-2)]'
              : 'ml-3 text-[var(--danger)]'
          }
        >
          {msg.text}
        </span>
      )}
    </div>
  )
}
