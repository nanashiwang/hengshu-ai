// 分页纯逻辑（与视图分离，便于单测）：页码窗口 + 查询串构造。
export type PageParams = Record<string, string | number | undefined>

// 构造分页链接的查询串：page<=1 时省略该参数以保持 URL 干净；空值过滤。
export function buildPageQuery(params: PageParams, pageKey: string, page: number): string {
  const merged: PageParams = { ...params, [pageKey]: page }
  return Object.entries(merged)
    .filter(([k, v]) => v != null && v !== '' && !(k === pageKey && Number(v) <= 1))
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&')
}

// 紧凑页码窗口：始终含首尾 + 当前页±1，跳段以省略号表示。
export function pageWindow(page: number, total: number): (number | '…')[] {
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
