import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Section, Empty } from '@/components/console/ConsoleUI'
import { FailureTriageActions } from '@/components/console/FailureTriageActions'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { timeAgo } from '@/lib/format'

export const dynamic = 'force-dynamic'

const REVIEWER_ROLES = ['admin', 'reviewer']
const TRIAGE_LABELS: Record<string, string> = {
  pending: '待归因',
  attributed: '已归因',
  needs_more_evidence: '证据不足',
  verified: '已复验',
}
const ROOT_LABELS: Record<string, string> = {
  model_drift: '模型漂移',
  prompt_boundary: 'Prompt 边界',
  schema_mismatch: 'Schema 不匹配',
  adapter_gap: 'Adapter 缺口',
  data_quality: '数据/输入质量',
  unknown: '未知',
}

function relationId(value: any) {
  if (!value) return ''
  if (typeof value === 'object') return String(value.id || '')
  return String(value)
}

function relationTitle(value: any) {
  if (!value) return '—'
  if (typeof value === 'object') return value.title || value.slug || value.id || '—'
  return String(value)
}

export default async function FailureTriagePage() {
  const user = await getCurrentUser()
  if (!user || !REVIEWER_ROLES.includes(String((user as any).role || ''))) redirect('/console')
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'failure-cases' as any,
    where: {
      or: [
        { triageStatus: { equals: 'pending' } },
        { triageStatus: { equals: 'needs_more_evidence' } },
        { triageStatus: { exists: false } },
      ],
    },
    depth: 1,
    limit: 100,
    sort: '-occurrenceCount',
    overrideAccess: true,
  })
  const docs = res.docs as any[]

  return (
    <div className="space-y-4">
      <Section
        title={`失败归因（${res.totalDocs}）`}
        action={
          <Link href="/console/admin/failure-cases" className="text-xs text-[var(--accent)] hover:underline">
            后台全集
          </Link>
        }
      >
        <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-3 text-xs text-[var(--muted)]">
          这里把自动聚类的 FailureCase 变成人工可复核知识：只看错误类型、输入档、模型版本、脱敏症状和复验覆盖；不要粘贴原始输入输出。
        </div>
        {docs.length === 0 ? (
          <Empty>暂无待归因失败案例。</Empty>
        ) : (
          <ul className="space-y-3">
            {docs.map((failure) => {
              const skillId = relationId(failure.skill)
              const coverage = failure.verificationCoverage && typeof failure.verificationCoverage === 'object'
                ? failure.verificationCoverage
                : {}
              return (
                <li key={failure.id} className="rounded-xl border border-[var(--border)] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                        <span className="rounded border border-[var(--border)] px-1.5 py-0.5">
                          {TRIAGE_LABELS[String(failure.triageStatus || 'pending')] || failure.triageStatus || 'pending'}
                        </span>
                        <span>{failure.status || 'observed'}</span>
                        <span>· {timeAgo(failure.lastObservedAt || failure.updatedAt || failure.createdAt)}</span>
                        <span>出现 {failure.occurrenceCount || 0} 次</span>
                        <span>影响 {failure.affectedSkillCount || 0} 个 Skill</span>
                      </div>
                      <h2 className="text-base font-semibold">{failure.title || '未命名失败案例'}</h2>
                      <div className="grid gap-2 text-xs text-[var(--muted)] md:grid-cols-2">
                        <div>错误：{failure.errorType || '—'}</div>
                        <div>根因：{ROOT_LABELS[String(failure.rootCauseCategory || '')] || '待归因'}</div>
                        <div>模型：{failure.modelName || '—'}{failure.primaryModelVersion ? ` · ${failure.primaryModelVersion}` : ''}</div>
                        <div>输入档：{failure.primaryInputBucket || (Array.isArray(failure.inputBuckets) ? failure.inputBuckets.join(' / ') : '—')}</div>
                        <div>Skill：{relationTitle(failure.skill)}</div>
                        <div>复验：{coverage.verifiedRuns ?? 0}/{coverage.targetRuns ?? 0}</div>
                      </div>
                      {failure.symptom ? <p className="text-sm text-[var(--text)]">症状：{failure.symptom}</p> : null}
                      {failure.likelyCause ? <p className="text-sm text-[var(--muted)]">可能原因：{failure.likelyCause}</p> : null}
                      {failure.triageNotes ? (
                        <p className="rounded border border-[var(--border)] bg-[var(--panel-2)] p-2 text-xs text-[var(--muted)]">
                          上次归因：{failure.triageNotes}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Link href={`/admin/collections/failure-cases/${failure.id}`} target="_blank" className="text-[var(--accent)] hover:underline">
                          后台详情
                        </Link>
                        <Link href={`/failures?profileKey=${encodeURIComponent(String(failure.profileKey || ''))}`} className="text-[var(--accent)] hover:underline">
                          前台失败库
                        </Link>
                        <Link href={`/console/runs?success=false${skillId ? `&skillId=${encodeURIComponent(skillId)}` : ''}${failure.modelName ? `&model=${encodeURIComponent(String(failure.modelName))}` : ''}`} className="text-[var(--accent)] hover:underline">
                          私人台账复现
                        </Link>
                        <a href={`/v1/adapters?failureId=${encodeURIComponent(String(failure.id))}`} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">
                          Adapter API
                        </a>
                      </div>
                    </div>
                    <div className="w-full shrink-0 lg:w-80">
                      <FailureTriageActions failureId={String(failure.id)} />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </div>
  )
}
