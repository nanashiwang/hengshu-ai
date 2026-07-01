import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { formatNumber } from '@/lib/format'
import { Stat } from '@/components/console/ConsoleUI'

export const dynamic = 'force-dynamic'

export default async function ConsoleOverview() {
  const user = await getCurrentUser()
  const u = user as any
  const payload = await getPayloadClient()
  const uid = u.id as string

  const runners = await payload.find({
    collection: 'runner-clients',
    where: { user: { equals: uid } },
    depth: 0,
    limit: 100,
    overrideAccess: true,
  })
  const runnerIds = runners.docs.map((r: any) => r.id)

  const [installs, runs, compatCount] = await Promise.all([
    payload.count({
      collection: 'skill-installs',
      where: { and: [{ user: { equals: uid } }, { status: { equals: 'installed' } }] },
      overrideAccess: true,
    }),
    payload.count({ collection: 'skill-runs', where: { user: { equals: uid } }, overrideAccess: true }),
    runnerIds.length
      ? payload.count({ collection: 'compat-reports', where: { runner: { in: runnerIds } }, overrideAccess: true })
      : Promise.resolve({ totalDocs: 0 } as any),
  ])

  const cards = [
    { href: '/console/installs', label: '已安装 Skill', value: installs.totalDocs },
    { href: '/console/runners', label: 'Runner 实例', value: runners.totalDocs },
    { href: '/console/runs', label: '运行记录', value: runs.totalDocs },
    { href: '/console/contributions', label: '兼容贡献', value: compatCount.totalDocs },
  ]

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{u.username}</h1>
            <p className="text-sm text-[var(--muted)]">{u.email}</p>
          </div>
          <div className="flex gap-6 text-center">
            <Stat label="术值" value={formatNumber(u.contributionScore)} />
            <Stat label="可用邀请" value={String(u.inviteCount ?? 0)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="card p-4 text-center transition-colors hover:border-[var(--accent)]"
          >
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="mt-1 text-xs text-[var(--muted)]">{c.label}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
