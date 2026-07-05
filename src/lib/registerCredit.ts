export function registerCreditIdempotencyKey(userId: string): string {
  return `register:${userId}`
}

export function normalizeRegisterCreditAmount(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return Math.max(0, Math.floor(n))
}
