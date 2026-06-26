import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { formatNumber } from '@/lib/format'

const NAV = [
  { href: '/skills', label: 'Skill 市场' },
  { href: '/rank', label: '排行榜' },
  { href: '/bounties', label: '悬赏区' },
  { href: '/docs', label: '文档' },
]

export async function SiteNav() {
  const user = await getCurrentUser()
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="text-lg text-[var(--accent)]">⬡</span>
          <span>
            元衡 <span className="text-[var(--accent)]">SkillHub</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-4 text-sm text-[var(--muted)] sm:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-[var(--text)]">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="hidden text-[var(--muted)] sm:inline" title="贡献值">
                ⚡ {formatNumber((user as any).contributionScore)}
              </span>
              <Link href="/me" className="text-[var(--muted)] hover:text-[var(--text)]">
                {(user as any).username || '个人中心'}
              </Link>
              {(user as any).role === 'admin' && (
                <Link
                  href="/admin"
                  className="text-[var(--muted)] hover:text-[var(--text)]"
                  target="_blank"
                >
                  后台
                </Link>
              )}
            </>
          ) : (
            <>
              <Link href="/login" className="text-[var(--muted)] hover:text-[var(--text)]">
                登录
              </Link>
              <Link
                href="/register"
                className="rounded-md border border-[var(--border)] px-3 py-1 hover:border-[var(--accent)]"
              >
                注册
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
