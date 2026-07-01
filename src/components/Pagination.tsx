import Link from 'next/link'
import { buildPageQuery, pageWindow, type PageParams } from '@/lib/pagination'

// 纯服务端分页组件（无 client hook，仅 <Link>）：多处列表页共用。
// 语义：page 1-indexed；params 为需保留的查询参数（会被 page 覆盖，page<=1 时省略以保持 URL 干净）。
// 纯逻辑(页码窗口/查询串)见 src/lib/pagination.ts，便于单测。

export function Pagination({
  page,
  totalPages,
  basePath,
  params = {},
  pageKey = 'page',
}: {
  page: number
  totalPages: number
  basePath: string
  params?: PageParams
  pageKey?: string
}) {
  if (totalPages <= 1) return null
  // 防越界：?page=999 时 Payload 回显请求页号，clamp 到 [1,totalPages] 避免坏的上/下页链接把用户困在空页
  const cur = Math.min(Math.max(page, 1), totalPages)
  const href = (p: number) => {
    const qs = buildPageQuery(params, pageKey, p)
    return qs ? `${basePath}?${qs}` : basePath
  }
  const items = pageWindow(cur, totalPages)
  const cell = 'inline-flex min-w-[2rem] items-center justify-center rounded-md border px-2.5 py-1.5 text-sm'
  const idle = 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)]'
  const disabled = 'border-[var(--border)] text-[var(--border)] cursor-default'

  return (
    <nav className="flex flex-wrap items-center justify-center gap-1 pt-2" aria-label="分页">
      {cur > 1 ? (
        <Link href={href(cur - 1)} className={`${cell} ${idle}`}>
          ‹ 上一页
        </Link>
      ) : (
        <span className={`${cell} ${disabled}`}>‹ 上一页</span>
      )}
      {items.map((it, idx) =>
        it === '…' ? (
          <span key={`e${idx}`} className="px-1.5 text-[var(--muted)]">
            …
          </span>
        ) : (
          <Link
            key={it}
            href={href(it)}
            aria-current={it === cur ? 'page' : undefined}
            className={`${cell} ${
              it === cur ? 'border-[var(--accent)] font-semibold text-[var(--accent)]' : idle
            }`}
          >
            {it}
          </Link>
        ),
      )}
      {cur < totalPages ? (
        <Link href={href(cur + 1)} className={`${cell} ${idle}`}>
          下一页 ›
        </Link>
      ) : (
        <span className={`${cell} ${disabled}`}>下一页 ›</span>
      )}
    </nav>
  )
}
