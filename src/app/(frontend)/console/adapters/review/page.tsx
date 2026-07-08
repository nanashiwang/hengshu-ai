import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Section, Empty } from '@/components/console/ConsoleUI'
import { AdapterReviewActions } from '@/components/console/AdapterReviewActions'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { timeAgo } from '@/lib/format'

export const dynamic = 'force-dynamic'

const REVIEWER_ROLES = ['admin', 'reviewer']
const STATUS_LABELS: Record<string, string> = {
  pending: '待评审',
  needs_changes: '需修改',
  approved: '已批准',
  rejected: '已拒绝',
}

function relationTitle(value: any) {
  if (!value) return '—'
  if (typeof value === 'object') return value.title || value.slug || value.modelName || value.id || '—'
  return String(value)
}

function relationId(value: any) {
  if (!value) return ''
  if (typeof value === 'object') return String(value.id || '')
  return String(value)
}

export default async function AdapterReviewPage() {
  const user = await getCurrentUser()
  if (!user || !REVIEWER_ROLES.includes(String((user as any).role || ''))) redirect('/console')
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'adapter-profiles' as any,
    where: {
      or: [
        { reviewStatus: { equals: 'pending' } },
        { reviewStatus: { equals: 'needs_changes' } },
        { reviewStatus: { exists: false } },
      ],
    },
    depth: 1,
    limit: 100,
    sort: '-updatedAt',
    overrideAccess: true,
  })
  const docs = res.docs as any[]

  return (
    <div className="space-y-4">
      <Section
        title={`Adapter 人工评审（${res.totalDocs}）`}
        action={
          <Link href="/console/admin/adapter-profiles" className="text-xs text-[var(--accent)] hover:underline">
            后台全集
          </Link>
        }
      >
        <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-3 text-xs text-[var(--muted)]">
          只在这里批准经过人工复核的 Adapter：确认来源 FailureCase、适用 SkillVersion、modelName/modelVersion、补丁边界和至少一条私人台账复验计划。批准后才会进入公开 `/v1/adapters` 与运行时 active 复用链路。
        </div>
        {docs.length === 0 ? (
          <Empty>暂无待评审 Adapter。</Empty>
        ) : (
          <ul className="space-y-3">
            {docs.map((adapter) => {
              const failureId = relationId(adapter.sourceFailureCase)
              return (
                <li key={adapter.id} className="rounded-xl border border-[var(--border)] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                        <span className="rounded border border-[var(--border)] px-1.5 py-0.5">
                          {STATUS_LABELS[String(adapter.reviewStatus || 'pending')] || adapter.reviewStatus || 'pending'}
                        </span>
                        <span>{adapter.status || 'draft'}</span>
                        <span>· {timeAgo(adapter.updatedAt || adapter.createdAt)}</span>
                        <span className="font-mono">{String(adapter.id).slice(0, 10)}…</span>
                      </div>
                      <h2 className="text-base font-semibold">{adapter.title || '未命名 Adapter'}</h2>
                      <div className="grid gap-2 text-xs text-[var(--muted)] md:grid-cols-2">
                        <div>Skill：{relationTitle(adapter.skill)}</div>
                        <div>版本：{relationTitle(adapter.skillVersion)}</div>
                        <div>模型：{adapter.modelName || '—'}{adapter.modelVersion ? ` · ${adapter.modelVersion}` : ''}</div>
                        <div>失败类型：{Array.isArray(adapter.failureTypes) && adapter.failureTypes.length ? adapter.failureTypes.join(' / ') : '—'}</div>
                        <div>来源失败：{failureId ? <Link href={`/failures?failureId=${encodeURIComponent(failureId)}`} className="text-[var(--accent)] hover:underline">{relationTitle(adapter.sourceFailureCase)}</Link> : '—'}</div>
                        <div>lift：{adapter.liftScore ?? 0} · 前 {adapter.beforeMetrics?.samples ?? 0} / 后 {adapter.afterMetrics?.samples ?? 0}</div>
                      </div>
                      {adapter.reviewerNotes ? (
                        <p className="rounded border border-[var(--border)] bg-[var(--panel-2)] p-2 text-xs text-[var(--muted)]">
                          上次备注：{adapter.reviewerNotes}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Link href={`/admin/collections/adapter-profiles/${adapter.id}`} target="_blank" className="text-[var(--accent)] hover:underline">
                          后台查看补丁正文
                        </Link>
                        {adapter.modelName ? (
                          <Link href={`/console/runs?model=${encodeURIComponent(String(adapter.modelName))}&success=false`} className="text-[var(--accent)] hover:underline">
                            私人台账复验
                          </Link>
                        ) : null}
                        <a href={`/v1/adapters?failureId=${encodeURIComponent(failureId || String(adapter.sourceFailureCase || ''))}`} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">
                          公开 API 检查
                        </a>
                      </div>
                    </div>
                    <div className="w-full shrink-0 lg:w-80">
                      <AdapterReviewActions adapterId={String(adapter.id)} />
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
