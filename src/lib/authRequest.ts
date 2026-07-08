import { readJsonBodyWithLimit } from './requestBody'

export const MAX_AUTH_REQUEST_BYTES = 20_000
export const MAX_AUTH_IDENTIFIER_LENGTH = 254
export const MAX_AUTH_USERNAME_LENGTH = 80
export const MAX_AUTH_PASSWORD_LENGTH = 1_024
export const MAX_AUTH_INVITE_CODE_LENGTH = 128
export const MAX_AUTH_DEVICE_ID_LENGTH = 128

export type AuthBodyResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: 400 | 413; error: string }

function contentLengthTooLarge(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || 0)
  return Number.isFinite(contentLength) && contentLength > MAX_AUTH_REQUEST_BYTES
}

function limited(value: unknown, maxLength: number, field: string): string | AuthBodyResult {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text.length > maxLength) return { ok: false, status: 400, error: `${field} 过长` }
  return text
}

function limitedPassword(value: unknown): string | AuthBodyResult {
  const text = typeof value === 'string' ? value : ''
  if (text.length > MAX_AUTH_PASSWORD_LENGTH) return { ok: false, status: 400, error: 'password 过长' }
  return text
}

export async function readAuthJsonBody(request: Request): Promise<AuthBodyResult> {
  const parsed = await readJsonBodyWithLimit(request, MAX_AUTH_REQUEST_BYTES, '认证请求体过大')
  if (!parsed.ok) return parsed
  if (!parsed.value || typeof parsed.value !== 'object' || Array.isArray(parsed.value)) {
    return { ok: false, status: 400, error: '请求体必须是 JSON 对象' }
  }
  return { ok: true, body: parsed.value }
}

export async function readAuthFormBody(request: Request, fields: string[]): Promise<AuthBodyResult> {
  if (contentLengthTooLarge(request)) return { ok: false, status: 413, error: '认证请求体过大' }
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return { ok: false, status: 400, error: '请求体无效' }
  }
  const body: Record<string, unknown> = {}
  for (const field of fields) body[field] = form.get(field)
  return { ok: true, body }
}

export function normalizeLoginBody(body: Record<string, unknown>): AuthBodyResult {
  const identifier = limited(body.identifier ?? body.email ?? body.username, MAX_AUTH_IDENTIFIER_LENGTH, 'identifier')
  const password = limitedPassword(body.password)
  if (isAuthBodyError(identifier)) return identifier
  if (isAuthBodyError(password)) return password
  return { ok: true, body: { identifier, password } }
}

export function normalizeRegisterBody(body: Record<string, unknown>): AuthBodyResult {
  const email = limited(body.email, MAX_AUTH_IDENTIFIER_LENGTH, 'email')
  const username = limited(body.username, MAX_AUTH_USERNAME_LENGTH, 'username')
  const password = limitedPassword(body.password)
  const inviteCode = limited(body.inviteCode, MAX_AUTH_INVITE_CODE_LENGTH, 'inviteCode')
  const deviceId = limited(body.deviceId, MAX_AUTH_DEVICE_ID_LENGTH, 'deviceId')
  for (const value of [email, username, password, inviteCode, deviceId]) {
    if (isAuthBodyError(value)) return value
  }
  return { ok: true, body: { email, username, password, inviteCode, deviceId } }
}

export function isAuthBodyError(value: unknown): value is Exclude<AuthBodyResult, { ok: true }> {
  return Boolean(value && typeof value === 'object' && (value as any).ok === false)
}
