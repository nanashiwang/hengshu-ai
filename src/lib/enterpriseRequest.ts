export const MAX_ENTERPRISE_REQUEST_BYTES = 100_000
export const MAX_ENTERPRISE_SCIM_REQUEST_BYTES = 100_000
export const MAX_ENTERPRISE_ID_LENGTH = 120
export const MAX_ENTERPRISE_TEXT_LENGTH = 4_000
export const MAX_ENTERPRISE_LIST_ITEMS = 100
export const MAX_ENTERPRISE_EMAIL_LENGTH = 254
export const MAX_ENTERPRISE_SCIM_FILTER_LENGTH = 500

export type EnterpriseRequestValidation =
  | { ok: true }
  | { ok: false; status: 400 | 413; error: string }
export type EnterpriseRequestError = Exclude<EnterpriseRequestValidation, { ok: true }>

function limitedString(value: unknown, maxLength = MAX_ENTERPRISE_ID_LENGTH): string | null {
  if (typeof value !== 'string') return ''
  const text = value.trim()
  return text.length > maxLength ? null : text
}

export function readEnterpriseQueryId(params: URLSearchParams, key = 'organizationId'): string | EnterpriseRequestError {
  const value = limitedString(params.get(key))
  if (value == null) return { ok: false, status: 400, error: `${key} 过长` }
  if (!value) return { ok: false, status: 400, error: `缺少 ${key}` }
  return value
}

export function readEnterpriseOptionalQuery(params: URLSearchParams, key: string, maxLength = MAX_ENTERPRISE_ID_LENGTH): string | EnterpriseRequestError {
  const value = limitedString(params.get(key), maxLength)
  if (value == null) return { ok: false, status: 400, error: `${key} 过长` }
  return value
}

export function requireEnterpriseIds(body: any, fields: string[]): EnterpriseRequestValidation {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, error: '请求体必须是 JSON 对象' }
  }
  for (const field of fields) {
    const value = limitedString(body[field])
    if (value == null) return { ok: false, status: 400, error: `${field} 过长` }
    if (!value) return { ok: false, status: 400, error: `缺少 ${fields.join(' 或 ')}` }
  }
  return { ok: true }
}

export function validateEnterpriseText(value: unknown, field: string): EnterpriseRequestValidation {
  if (value == null) return { ok: true }
  if (typeof value !== 'string') return { ok: true }
  return value.length > MAX_ENTERPRISE_TEXT_LENGTH
    ? { ok: false, status: 400, error: `${field} 过长` }
    : { ok: true }
}

export function validateEnterpriseStringList(value: unknown, field: string): EnterpriseRequestValidation {
  if (value == null) return { ok: true }
  if (!Array.isArray(value)) return { ok: true }
  if (value.length > MAX_ENTERPRISE_LIST_ITEMS) return { ok: false, status: 413, error: `${field} 项过多` }
  if (value.some((item) => typeof item === 'string' && item.length > MAX_ENTERPRISE_ID_LENGTH)) {
    return { ok: false, status: 400, error: `${field} 含过长项` }
  }
  return { ok: true }
}
