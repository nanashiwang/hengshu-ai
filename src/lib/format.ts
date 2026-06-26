// 展示层格式化工具

export const formatCost = (c?: number | null): string => {
  if (c == null) return '—'
  if (c === 0) return '免费'
  return `¥${c < 0.01 ? c.toFixed(4) : c.toFixed(3)}`
}

export const formatLatency = (ms?: number | null): string => {
  if (ms == null || ms === 0) return '—'
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`
}

export const formatPercent = (v?: number | null): string => {
  if (v == null) return '—'
  return `${Math.round(v * 100)}%`
}

export const formatNumber = (n?: number | null): string => {
  if (n == null) return '0'
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

export function timeAgo(d?: string | Date | null): string {
  if (!d) return '—'
  const diff = Date.now() - new Date(d).getTime()
  const day = 86_400_000
  if (diff < 0) return '刚刚'
  if (diff < 3_600_000) return `${Math.max(1, Math.round(diff / 60_000))} 分钟前`
  if (diff < day) return `${Math.round(diff / 3_600_000)} 小时前`
  if (diff < 30 * day) return `${Math.round(diff / day)} 天前`
  return new Date(d).toLocaleDateString('zh-CN')
}
