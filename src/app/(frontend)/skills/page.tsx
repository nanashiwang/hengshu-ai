import Link from 'next/link'
import { getPayloadClient } from '@/lib/payload'
import { SkillStatusTags } from '@/components/Tag'
import { Pagination } from '@/components/Pagination'
import {
  formatCost,
  formatLatency,
  formatNumber,
  formatPercent,
  timeAgo,
} from '@/lib/format'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

const SORTS = [
  { key: 'skillRank', label: '综合', sort: '-skillRank' },
  { key: 'runs', label: '调用量', sort: '-runCount' },
  { key: 'new', label: '最新', sort: '-createdAt' },
  { key: 'success', label: '成功率', sort: '-successRate' },
]

type SP = Record<string, string | undefined>

function buildHref(base: SP, patch: SP): string {
  const merged: SP = { ...base, ...patch }
  const qs = Object.entries(merged)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
    .join('&')
  return qs ? `/skills?${qs}` : '/skills'
}

export default async function SkillsPage({
  searchParams,
}: {
  searchParams: Promise<SP>
}) {
  const sp = await searchParams
  const payload = await getPayloadClient()

  const categories = (await payload.find({ collection: 'categories', limit: 50, sort: 'order' }))
    .docs
  const activeCat = sp.category ? categories.find((c: any) => c.slug === sp.category) : null
  const sortKey = sp.sort || 'skillRank'
  const sort = SORTS.find((s) => s.key === sortKey)?.sort || '-skillRank'
  const q = sp.q?.trim()

  const where: any = {
    and: [{ status: { equals: 'published' } }, { visibility: { equals: 'public' } }],
  }
  if (activeCat) where.and.push({ category: { equals: activeCat.id } })
  if (q) where.and.push({ title: { like: q } })

  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1)
  const res = await payload.find({
    collection: 'skills',
    where,
    depth: 1,
    limit: PAGE_SIZE,
    page,
    sort,
  })
  const skills = res.docs

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Skill 市场</h1>
        <span className="text-sm text-[var(--muted)]">{res.totalDocs} 个 Skill</span>
      </div>

      {/* 分类筛选 */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={buildHref(sp, { category: undefined, page: undefined })}
          className={`rounded-full border px-3 py-1 text-sm ${
            !activeCat
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          全部
        </Link>
        {categories.map((c: any) => (
          <Link
            key={c.id}
            href={buildHref(sp, { category: c.slug, page: undefined })}
            className={`rounded-full border px-3 py-1 text-sm ${
              activeCat?.id === c.id
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {c.icon} {c.name}
          </Link>
        ))}
      </div>

      {/* 排序 + 搜索 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 text-sm">
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={buildHref(sp, { sort: s.key, page: undefined })}
              className={`rounded-md px-3 py-1 ${
                sortKey === s.key
                  ? 'bg-[var(--panel-2)] text-[var(--text)]'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
        <form method="get" className="flex gap-2">
          {activeCat && <input type="hidden" name="category" value={activeCat.slug ?? ''} />}
          <input type="hidden" name="sort" value={sortKey} />
          <input
            name="q"
            defaultValue={q || ''}
            placeholder="搜索 Skill…"
            className="w-48 rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
          />
          <button className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:border-[var(--accent)]">
            搜索
          </button>
        </form>
      </div>

      {/* PT 风格资源表 */}
      {skills.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center text-[var(--muted)]">
          没有匹配的 Skill。
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--panel)] text-left text-xs text-[var(--muted)]">
                <th className="px-3 py-2 font-medium">分类</th>
                <th className="px-3 py-2 font-medium">Skill</th>
                <th className="px-3 py-2 font-medium">作者</th>
                <th className="px-3 py-2 text-right font-medium">SkillRank</th>
                <th className="px-3 py-2 text-right font-medium">成功率</th>
                <th className="px-3 py-2 text-right font-medium">成本</th>
                <th className="px-3 py-2 text-right font-medium">耗时</th>
                <th className="px-3 py-2 text-right font-medium">调用</th>
                <th className="px-3 py-2 text-right font-medium">收藏</th>
                <th className="px-3 py-2 font-medium">更新</th>
              </tr>
            </thead>
            <tbody>
              {skills.map((s: any) => {
                const cat = typeof s.category === 'object' ? s.category : null
                const author = typeof s.author === 'object' ? s.author : null
                return (
                  <tr
                    key={s.id}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--panel)]"
                  >
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-[var(--muted)]">
                      {cat ? `${cat.icon} ${cat.name}` : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/skills/${s.slug}`} className="font-medium hover:text-[var(--accent)]">
                        {s.title}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <SkillStatusTags skill={s} />
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-[var(--muted)]">
                      {author?.username || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-[var(--accent)]">
                      {Math.round(s.skillRank || 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right">{formatPercent(s.successRate)}</td>
                    <td className="px-3 py-2.5 text-right">{formatCost(s.avgCost)}</td>
                    <td className="px-3 py-2.5 text-right">{formatLatency(s.avgLatencyMs)}</td>
                    <td className="px-3 py-2.5 text-right">{formatNumber(s.runCount)}</td>
                    <td className="px-3 py-2.5 text-right">{formatNumber(s.favoriteCount)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-[var(--muted)]">
                      {timeAgo(s.lastUpdatedAt || s.createdAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={res.page || page} totalPages={res.totalPages || 1} basePath="/skills" params={sp} />
    </div>
  )
}
