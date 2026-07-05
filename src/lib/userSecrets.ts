import { decryptSecret, encryptSecret } from '@/lib/secrets'

export function normalizeNewApiKeyForStorage(value: unknown): string | null | undefined {
  if (typeof value === 'undefined') return undefined
  if (value == null) return null

  const raw = String(value).trim()
  if (!raw) return null

  if (raw.startsWith('enc:v1:') && !decryptSecret(raw)) {
    throw new Error('无效的模型网关 Key 密文')
  }

  return encryptSecret(raw)
}
