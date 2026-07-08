export const MAX_DEVICE_AUTH_REQUEST_BYTES = 20_000
export const MAX_DEVICE_META_LENGTH = 120
export const MAX_DEVICE_CODE_LENGTH = 120

export type DeviceAuthError = { ok: false; status: 400; error: string }

function limitedString(value: unknown, maxLength: number): string | DeviceAuthError {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text.length > maxLength) return { ok: false, status: 400, error: '字段过长' }
  return text
}

export function normalizeDeviceCodeMeta(body: any): { runnerVersion?: string; os?: string; arch?: string; label?: string } | DeviceAuthError {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {}
  const runnerVersion = limitedString(body.runnerVersion, MAX_DEVICE_META_LENGTH)
  const os = limitedString(body.os, MAX_DEVICE_META_LENGTH)
  const arch = limitedString(body.arch, MAX_DEVICE_META_LENGTH)
  const label = limitedString(body.label, MAX_DEVICE_META_LENGTH)
  for (const value of [runnerVersion, os, arch, label]) {
    if (isDeviceAuthError(value)) return value
  }
  return {
    runnerVersion: String(runnerVersion || '') || undefined,
    os: String(os || '') || undefined,
    arch: String(arch || '') || undefined,
    label: String(label || '') || undefined,
  }
}

export function normalizeDeviceCode(value: unknown, error = 'invalid_request'): string | DeviceAuthError {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return { ok: false, status: 400, error }
  if (text.length > MAX_DEVICE_CODE_LENGTH) return { ok: false, status: 400, error: '字段过长' }
  return text
}

export function normalizeUserCode(value: unknown): string | DeviceAuthError {
  const text = normalizeDeviceCode(value, '请输入设备码')
  return isDeviceAuthError(text) ? text : text.toUpperCase()
}

export function isDeviceAuthError(value: unknown): value is DeviceAuthError {
  return Boolean(value && typeof value === 'object' && (value as any).ok === false)
}
