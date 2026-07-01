import Link from 'next/link'

// 纯服务端分页组件（无 client hook，仅 <Link>）：三处列表页共用。
// 语义：page 1-indexed；params 为需保留的查询参数（会被 page 覆盖，page<=1 时省略以保持 URL 干净）。

type Params = Record<string, string | number | undefined>

function buildQuery(params: Params, pageKey: string, page: number): string {
  const merged: Params = { ...params, [pageKey]: page }
  return Object.entries(merged)
    .filter(([k, v]) => v != null && v !== '' && !(k === pageKey && Number(v) <= 1))
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&')
}

// 紧凑页码窗口：始终含首尾 + 当前页±1，跳段以省略号表示。
function pageWindow(page: number, total: number): (number | '…')[] {
  const near = new Set<number>([1, total])
  for (let p = page - 1; p <= page + 1; p++) if (p >= 1 && p <= total) near.add(p)
  const sorted = [...near].sort((a, b) => a - b)
  const items: (number | '…')[] = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) items.push('…')
    items.push(p)
    prev = p
  }
  return items
}

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
  params?: Params
  pageKey?: string
}) {
  if (totalPages <= 1) return null
  // 防越界：?page=999 时 Payload 回显请求页号，clamp 到 [1,totalPages] 避免坏的上/下页链接把用户困在空页
  const cur = Math.min(Math.max(page, 1), totalPages)
  const href = (p: number) => {
    const qs = buildQuery(params, pageKey, p)
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
