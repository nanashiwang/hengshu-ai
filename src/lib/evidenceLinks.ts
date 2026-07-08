export type EvidenceVerifyTargetType = 'skill_passport' | 'failure_case' | 'adapter_profile'
export const MAX_CERTIFICATE_VERIFY_URL_LENGTH = 240

export function evidenceVerifyApiUrl(targetType: EvidenceVerifyTargetType, targetId?: unknown) {
  if (!targetId) return null
  return `/v1/evidence/verify?targetType=${targetType}&targetId=${encodeURIComponent(String(targetId))}`
}

export function evidenceVerifyPageUrl(targetType: EvidenceVerifyTargetType, targetId?: unknown) {
  if (!targetId) return null
  return `/verify?targetType=${targetType}&targetId=${encodeURIComponent(String(targetId))}`
}

export function normalizeCertificateUrl(certificateUrl?: unknown) {
  if (!certificateUrl) return null
  const url = String(certificateUrl).trim()
  if (url.length > MAX_CERTIFICATE_VERIFY_URL_LENGTH) return null
  if (!url.startsWith('/v1/skills/') || url.startsWith('//')) return null
  const path = url.split(/[?#]/, 1)[0]
  const match = path.match(/^\/v1\/skills\/([^/?#]+)\/certificate$/)
  if (!match) return null
  try {
    const decodedSlug = decodeURIComponent(match[1])
    if (!decodedSlug || /[/?#\\]/.test(decodedSlug)) return null
  } catch {
    return null
  }
  return path
}

export function certificateVerifyPageUrl(certificateUrl?: unknown) {
  const safeUrl = normalizeCertificateUrl(certificateUrl)
  if (!safeUrl) return null
  return `/verify?certificateUrl=${encodeURIComponent(safeUrl)}`
}
