import { decryptSecret, encryptSecret } from './secrets'

export function metaWithPendingAccessToken(meta: Record<string, unknown>, token: string): Record<string, unknown> {
  const { pendingAccessToken: _legacy, pendingAccessTokenEncrypted: _old, ...rest } = meta || {}
  return { ...rest, pendingAccessTokenEncrypted: encryptSecret(token) }
}

export function pendingAccessTokenFromMeta(meta: Record<string, unknown>): string {
  const encrypted = typeof meta?.pendingAccessTokenEncrypted === 'string' ? meta.pendingAccessTokenEncrypted : ''
  const plain = decryptSecret(encrypted)
  if (plain) return plain
  // 旧版兼容仅限非生产；生产不再从 device-code.meta 读取明文 runner token。
  if (process.env.NODE_ENV !== 'production' && typeof meta?.pendingAccessToken === 'string') {
    return meta.pendingAccessToken
  }
  return ''
}

export function clearPendingAccessToken(meta: Record<string, unknown>): Record<string, unknown> {
  const { pendingAccessToken: _legacy, pendingAccessTokenEncrypted: _enc, ...rest } = meta || {}
  return rest
}
