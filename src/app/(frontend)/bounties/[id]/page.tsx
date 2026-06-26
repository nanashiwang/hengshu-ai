import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'
import { formatNumber, timeAgo } from '@/lib/format'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  open: '开放中',
  accepted: '已接单',
  submitted: '已提交',
  completed: '已完成',
  cancelled: '已取消',
}

export default async function BountyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const payload = await getPayloadClient()
  const bounty = await payload.findByID({ collection: 'bounties', id, depth: 1 }).catch(() => null)
  if (!bounty) notFound()
  const creator = typeof bounty.creator === 'object' ? bounty.creator : null

  return (
    <div className="space-y-4">
      <Link href="/bounties" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
        ← 返回悬赏区
      </Link>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[11px] text-[var(--muted)]">
              {STATUS_LABELS[bounty.status as string] || bounty.status}
            </span>
            <h1 className="mt-2 text-2xl font-bold">{bounty.title}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {creator?.username || '匿名'} · {timeAgo(bounty.createdAt)}
              {bounty.dueAt ? ` · 截止 ${new Date(bounty.dueAt).toLocaleDateString('zh-CN')}` : ''}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-2xl font-bold text-[var(--accent-2)]">⚡ {formatNumber(bounty.rewardPoints)}</div>
            <div className="text-xs text-[var(--muted)]">贡献值赏金</div>
          </div>
        </div>
        <div className="mt-4 whitespace-pre-wrap text-sm">{bounty.description || '（无详细说明）'}</div>
      </div>
      <p className="text-xs text-[var(--muted)]">
        接单与交付验收流程将在第三阶段（社区化）开放。当前为基础展示版。
      </p>
    </div>
  )
}
