export const MAX_SKILL_PACKAGE_FORM_BYTES = 20 * 1024 * 1024
export const MAX_SKILL_PACKAGE_TITLE_LENGTH = 120
export const MAX_SKILL_PACKAGE_DESCRIPTION_LENGTH = 2_000
export const MAX_SKILL_PACKAGE_CATEGORY_LENGTH = 80

export type SkillPackageFormPreflight =
  | { ok: true }
  | { ok: false; status: 413; error: string }

export type SkillPackageTextResult =
  | { ok: true; value: string }
  | { ok: false; status: 400; error: string }

export function preflightSkillPackageFormRequest(request: Request): SkillPackageFormPreflight {
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_SKILL_PACKAGE_FORM_BYTES) {
    return { ok: false, status: 413, error: 'Skill 包表单过大' }
  }
  return { ok: true }
}

export function readSkillPackageText(value: unknown, maxLength: number, field: string, required = false): SkillPackageTextResult {
  const text = typeof value === 'string' ? value.trim() : ''
  if (required && !text) return { ok: false, status: 400, error: '请填写 Skill 名称' }
  if (text.length > maxLength) return { ok: false, status: 400, error: `${field} 过长` }
  return { ok: true, value: text }
}
