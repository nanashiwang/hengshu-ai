import Link from 'next/link'
import { getPayloadClient } from '@/lib/payload'
import { SkillCard } from '@/components/SkillCard'

export const dynamic = 'force-dynamic'

async function getData() {
  const payload = await getPayloadClient()
  const [featured, recent, categories, stats] = await Promise.all([
    payload.find({
      collection: 'skills',
      where: { and: [{ status: { equals: 'published' } }, { isFeatured: { equals: true } }] },
      depth: 1,
      limit: 6,
      sort: '-skillRank',
    }),
    payload.find({
      collection: 'skills',
      where: { status: { equals: 'published' } },
      depth: 1,
      limit: 8,
      sort: '-createdAt',
    }),
    payload.find({ collection: 'categories', limit: 20, sort: 'order' }),
    payload.find({ collection: 'skills', where: { status: { equals: 'published' } }, limit: 0 }),
  ])
  return {
    featured: featured.docs,
    recent: recent.docs,
    categories: categories.docs,
    skillCount: stats.totalDocs,
  }
}

export default async function HomePage() {
  const { featured, recent, categories, skillCount } = await getData()
  const list = featured.length > 0 ? featured : recent.slice(0, 6)

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--panel)] to-[var(--panel-2)] p-8 sm:p-10">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight">经过评测的 AI Skill 市场</h1>
          <p className="mt-3 text-[var(--muted)]">
            发现、运行、评测和复用高质量 AI 技能。每个 Skill 都是可运行、可评测、可计费的能力包——
            告诉你「这个任务用哪个模型最省、最准、最稳」。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/skills"
              className="rounded-md bg-[var(--accent)] px-5 py-2.5 font-medium text-white hover:opacity-90"
            >
              浏览 Skill 市场
            </Link>
            <Link
              href="/rank"
              className="rounded-md border border-[var(--border)] px-5 py-2.5 font-medium hover:border-[var(--accent)]"
            >
              查看排行榜
            </Link>
          </div>
          <div className="mt-6 flex gap-6 text-sm text-[var(--muted)]">
            <span>
              <b className="text-[var(--text)]">{skillCount}</b> 个已发布 Skill
            </span>
            <span>
              <b className="text-[var(--text)]">{categories.length}</b> 个分类
            </span>
          </div>
        </div>
      </section>

      {/* 分类 */}
      <section>
        <div className="mb-3 flex flex-wrap gap-2">
          {categories.map((c: any) => (
            <Link
              key={c.id}
              href={`/skills?category=${c.slug}`}
              className="rounded-full border border-[var(--border)] px-3 py-1 text-sm text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
            >
              {c.icon} {c.name}
            </Link>
          ))}
        </div>
      </section>

      {/* 精选 Skill */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{featured.length > 0 ? '精选 Skill' : '最新 Skill'}</h2>
          <Link href="/skills" className="text-sm text-[var(--accent)] hover:underline">
            查看全部 →
          </Link>
        </div>
        {list.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((s: any) => (
              <SkillCard key={s.id} skill={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center text-[var(--muted)]">
      暂无 Skill。运行 <code className="text-[var(--text)]">npm run seed</code> 注入官方 Skill。
    </div>
  )
}
