import { redirect } from 'next/navigation'
import { Section, Empty } from '@/components/console/ConsoleUI'
import { ReportActions } from '@/components/console/ReportActions'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { STAFF_ROLES } from '@/lib/adminNav'
import { timeAgo } from '@/lib/format'

export const dynamic = 'force-dynamic'

const REASON_LABELS: Record<string, string> = {
  spam: '垃圾信息',
  low_quality: '低质量',
  copyright: '版权',
  abuse: '滥用/恶意',
  security: '安全风险',
  other: '其他',
}
const STATUS_LABELS: Record<string, string> = {
  open: '待处理',
  reviewing: '处理中',
  resolved: '已解决',
  dismissed: '已驳回',
}

export default async function ModerationPage() {
  const user = await getCurrentUser()
  if (!user || !STAFF_ROLES.includes((user as any).role)) redirect('/console')
  const payload = await getPayloadClient()
  const reports = await payload.find({
    collection: 'reports',
    sort: 'status', // open 优先靠字母序不保证，改按创建时间；此处按未处理在前
    where: {},
    depth: 1,
    limit: 100,
    overrideAccess: true,
  })
  // open/reviewing 在前
  const docs = [...(reports.docs as any[])].sort((a, b) => {
    const rank = (s: string) => (s === 'open' ? 0 : s === 'reviewing' ? 1 : 2)
    return rank(a.status) - rank(b.status) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return (
    <Section title={`举报处置（${reports.totalDocs}）`}>
      {docs.length === 0 ? (
        <Empty>暂无举报。</Empty>
      ) : (
        <ul className="space-y-3">
          {docs.map((r: any) => (
            <li key={r.id} className="rounded-lg border border-[var(--border)] p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                <span className="rounded border border-[var(--border)] px-1.5 py-0.5">{r.targetType}</span>
                <span>{REASON_LABELS[r.reason] || r.reason}</span>
                <span
                  className={`rounded px-1.5 py-0.5 ${
                    r.status === 'open' ? 'text-[var(--warn)]' : 'text-[var(--muted)]'
                  }`}
                >
                  {STATUS_LABELS[r.status] || r.status}
                </span>
                <span>· {timeAgo(r.createdAt)}</span>
                <span className="font-mono">目标 {String(r.targetId).slice(0, 10)}…</span>
              </div>
              {r.detail && <p className="mt-1 whitespace-pre-wrap text-sm">{r.detail}</p>}
              <div className="mt-2">
                {r.status === 'open' || r.status === 'reviewing' ? (
                  <ReportActions reportId={r.id} />
                ) : (
                  <span className="text-xs text-[var(--faint)]">
                    已由 {typeof r.handledBy === 'object' ? r.handledBy?.username : '—'} 处置
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
