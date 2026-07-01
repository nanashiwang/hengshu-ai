import { createHmac } from 'crypto'

// 取客户端 IP。⚠️ X-Forwarded-For 最左段可被客户端伪造，故从右往左取：
// 最右是最近可信反代追加的对端 IP；TRUSTED_PROXY_COUNT 指定己方可信代理层数（默认 0=取最右）。
// 生产务必让反代 append 真实对端（如 Nginx $proxy_add_x_forwarded_for / 覆盖式 X-Real-IP），否则 IP 不可信。
export function getClientIp(headers: Headers): string {
  const trusted = Math.max(0, Number(process.env.TRUSTED_PROXY_COUNT || 0))
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const chain = xff
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (chain.length > 0) {
      const idx = Math.max(0, chain.length - 1 - trusted)
      return chain[idx] || ''
    }
  }
  return (headers.get('x-real-ip') || '').trim()
}

// IP 哈希（HMAC，不可逆、保隐私）；空 IP 返回空串
export function hashIp(ip: string): string {
  if (!ip) return ''
  return createHmac('sha256', process.env.PAYLOAD_SECRET || 'hengshu-salt')
    .update(ip)
    .digest('hex')
    .slice(0, 32)
}
