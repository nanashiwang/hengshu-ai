export const MAX_ACCOUNT_REQUEST_BYTES = 50_000
export const MAX_RECHARGE_CODE_LENGTH = 128
export const MAX_BYOK_KEY_LENGTH = 4_000
export const MAX_USER_BIO_LENGTH = 500
export const MAX_NOTIFICATION_ID_LENGTH = 120

export type AccountRequestError = { ok: false; status: 400 | 413; error: string }

export function normalizeExchangeCredit(value: unknown): number | AccountRequestError {
  const credit = Math.floor(Number(value))
  if (!Number.isFinite(credit) || credit <= 0) {
    return { ok: false, status: 400, error: '请填写有效的兑换 credit 数' }
  }
  return credit
}

export function normalizeRechargeCodeInput(value: unknown): string | AccountRequestError {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return { ok: false, status: 400, error: '请输入充值码' }
  if (text.length > MAX_RECHARGE_CODE_LENGTH) return { ok: false, status: 400, error: '充值码过长' }
  return text
}

export function normalizeUserSettings(body: any): Record<string, string> | AccountRequestError {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, error: '请求体必须是 JSON 对象' }
  }
  const out: Record<string, string> = {}
  if (typeof body.newapiKey === 'string') {
    if (body.newapiKey.length > MAX_BYOK_KEY_LENGTH) return { ok: false, status: 400, error: 'newapiKey 过长' }
    out.newapiKey = body.newapiKey.trim()
  }
  if (typeof body.bio === 'string') {
    if (body.bio.length > MAX_USER_BIO_LENGTH) return { ok: false, status: 400, error: 'bio 过长' }
    out.bio = body.bio
  }
  return out
}

export function normalizeNotificationId(value: unknown): string | undefined | AccountRequestError {
  if (value == null || value === '') return undefined
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return undefined
  if (text.length > MAX_NOTIFICATION_ID_LENGTH) return { ok: false, status: 400, error: '通知 ID 过长' }
  return text
}

export function isAccountRequestError(value: unknown): value is AccountRequestError {
  return Boolean(value && typeof value === 'object' && (value as any).ok === false)
}
