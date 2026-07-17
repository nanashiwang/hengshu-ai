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

export type SkillPackageFormDataResult =
  | { ok: true; form: FormData }
  | { ok: false; status: 400 | 413; error: string }

export function preflightSkillPackageFormRequest(request: Request): SkillPackageFormPreflight {
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_SKILL_PACKAGE_FORM_BYTES) {
    return { ok: false, status: 413, error: 'Skill 包表单过大' }
  }
  return { ok: true }
}

export async function readSkillPackageFormData(
  request: Request,
  maxBytes = MAX_SKILL_PACKAGE_FORM_BYTES,
): Promise<SkillPackageFormDataResult> {
  const preflight = preflightSkillPackageFormRequest(request)
  if (!preflight.ok) return preflight
  if (!request.body) return { ok: false, status: 400, error: '表单数据无效' }

  const reader = request.body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel('Skill package form exceeds byte limit').catch(() => undefined)
        return { ok: false, status: 413, error: 'Skill 包表单过大' }
      }
      chunks.push(Buffer.from(value))
    }
  } catch {
    return { ok: false, status: 400, error: '表单数据无效' }
  }

  try {
    const boundedRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: Buffer.concat(chunks, total),
    })
    return { ok: true, form: await boundedRequest.formData() }
  } catch {
    return { ok: false, status: 400, error: '表单数据无效' }
  }
}

export function readSkillPackageText(value: unknown, maxLength: number, field: string, required = false): SkillPackageTextResult {
  const text = typeof value === 'string' ? value.trim() : ''
  if (required && !text) return { ok: false, status: 400, error: '请填写 Skill 名称' }
  if (text.length > maxLength) return { ok: false, status: 400, error: `${field} 过长` }
  return { ok: true, value: text }
}
