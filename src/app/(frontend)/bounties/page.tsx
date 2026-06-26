import Link from 'next/link'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'
import { BountyForm } from '@/components/BountyForm'
import { formatNumber, timeAgo } from '@/lib/format'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  open: '开放中',
  accepted: '已接单',
  submitted: '已提交',
  completed: '已完成',
  cancelled: '已取消',
}

export default async function BountiesPage() {
  const payload = await getPayloadClient()
  const user = await getCurrentUser()
  const res = await payload.find({
    collection: 'bounties',
    depth: 1,
    limit: 50,
    sort: '-createdAt',
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">悬赏区</h1>
          <p className="text-sm text-[var(--muted)]">把你的需求变成正向悬赏，创作者接单交付。</p>
        </div>
        <BountyForm loggedIn={!!user} />
      </div>

      {res.docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center text-[var(--muted)]">
          还没有悬赏。成为第一个发布需求的人。
        </div>
      ) : (
        <div className="space-y-3">
          {res.docs.map((b: any) => {
            const creator = typeof b.creator === 'object' ? b.creator : null
            return (
              <Link
                key={b.id}
                href={`/bounties/${b.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 hover:border-[var(--accent)]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[11px] text-[var(--muted)]">
                      {STATUS_LABELS[b.status] || b.status}
                    </span>
                    <h3 className="truncate font-medium">{b.title}</h3>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-[var(--muted)]">{b.description}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {creator?.username || '匿名'} · {timeAgo(b.createdAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-semibold text-[var(--accent-2)]">⚡ {formatNumber(b.rewardPoints)}</div>
                  <div className="text-xs text-[var(--muted)]">贡献值赏金</div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
