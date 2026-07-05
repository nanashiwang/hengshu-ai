export function normalizeExternalIdempotencyKey(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  // 客户端幂等键只接受短 ASCII token；异常输入拒绝，避免污染唯一索引/日志。
  return /^[A-Za-z0-9._:-]{16,128}$/.test(raw) ? raw : ''
}

export function scopedIdempotencyKey(scope: string, userId: string, externalKey: string): string {
  const cleanScope = String(scope || '').replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 32)
  const cleanUser = String(userId || '').replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 80)
  const cleanKey = normalizeExternalIdempotencyKey(externalKey)
  if (!cleanScope || !cleanUser || !cleanKey) return ''
  return `${cleanScope}:${cleanUser}:${cleanKey}`
}
