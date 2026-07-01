import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { ADMIN_ITEMS, ADMIN_GROUPS, adminEmbedUrl, STAFF_ROLES } from '@/lib/adminNav'
import { AdminFrame } from '@/components/console/AdminFrame'

export const dynamic = 'force-dynamic'

// 管理：分组（二级标题）下的某集合，组内集合以横向子标题 Tab 切换，内容区内嵌后台表
export default async function ConsoleAdminItem({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const user = await getCurrentUser()
  if (!user || !STAFF_ROLES.includes((user as any).role)) notFound()

  const item = ADMIN_ITEMS[slug]
  if (!item) notFound()
  const group = ADMIN_GROUPS.find((g) => g.items.some((i) => i.slug === slug))!
  const url = adminEmbedUrl(item)

  return (
    <div className="space-y-4">
      {/* 二级标题：分组名 */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{group.label}</h1>
        <a href={url} target="_blank" rel="noreferrer" className="text-xs text-[var(--accent)]">
          在新标签打开 ↗
        </a>
      </div>

      {/* 横向子标题：组内集合 Tab */}
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)]">
        {group.items.map((it) => {
          const active = it.slug === slug
          return (
            <Link
              key={it.slug}
              href={`/console/admin/${it.slug}`}
              className={`-mb-px rounded-t-lg border-b-2 px-3 py-2 text-sm transition-colors ${
                active
                  ? 'border-[var(--accent)] font-medium text-[var(--text)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {it.label}
            </Link>
          )
        })}
      </div>

      <AdminFrame src={url} />
    </div>
  )
}
