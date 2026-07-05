export function normalizeSiteUrl(value?: string, fallback = 'http://localhost:3000'): string {
  const raw = (value || fallback).trim() || fallback
  return raw.replace(/\/+$/, '')
}

// 服务端运行时 URL：优先 SERVER_URL，NEXT_PUBLIC_SERVER_URL 仅作为本地/兼容 fallback。
export function getServerUrl(env: Record<string, string | undefined> = process.env): string {
  return normalizeSiteUrl(env.SERVER_URL || env.NEXT_PUBLIC_SERVER_URL)
}
