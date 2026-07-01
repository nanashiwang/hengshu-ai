import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { formatNumber } from '@/lib/format'
import { ThemeToggle } from './ThemeToggle'
import { MobileNav } from './MobileNav'

const NAV = [
  { href: '/skills', label: 'Skill 市场' },
  { href: '/rank', label: '排行榜' },
  { href: '/bounties', label: '悬赏区' },
  { href: '/docs', label: '文档' },
]

export async function SiteNav() {
  const user = await getCurrentUser()
  const u = user as any
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg-elev)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-6 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)] text-sm text-white">
            ⬡
          </span>
          <span>
            衡术 <span className="text-[var(--accent)]">Hengshu</span>
          </span>
        </Link>

        <MobileNav items={NAV} />

        <nav className="hidden items-center gap-1 text-sm sm:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 text-sm">
          <ThemeToggle />
          {u ? (
            <>
              <span
                className="hidden items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--accent-2)] sm:inline-flex"
                title="贡献值"
              >
                ⚡ {formatNumber(u.contributionScore)}
              </span>
              <Link
                href="/console"
                className="rounded-lg px-3 py-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
              >
                {u.username || '控制台'}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 text-[var(--muted)] transition-colors hover:text-[var(--text)]"
              >
                登录
              </Link>
              <Link href="/register" className="btn btn-primary px-4 py-1.5">
                注册
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
