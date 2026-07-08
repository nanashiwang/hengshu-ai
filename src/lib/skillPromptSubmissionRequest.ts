export const MAX_SKILL_PROMPT_SUBMISSION_BYTES = 300_000
export const MAX_SKILL_TITLE_LENGTH = 120
export const MAX_SKILL_DESCRIPTION_LENGTH = 2_000
export const MAX_SKILL_SYSTEM_PROMPT_LENGTH = 40_000
export const MAX_SKILL_PROMPT_TEMPLATE_LENGTH = 80_000
export const MAX_SKILL_SCHEMA_BYTES = 30_000
export const MAX_SKILL_RECOMMENDED_MODELS_BYTES = 20_000
export const MAX_SKILL_CATEGORY_SLUG_LENGTH = 80

export type SkillPromptSubmission =
  | {
      ok: true
      value: {
        title: string
        description?: string
        systemPrompt?: string
        promptTemplate: string
        inputSchema: unknown
        recommendedModels: unknown
        categorySlug: string
        idempotencyKey?: unknown
      }
    }
  | { ok: false; status: 400 | 413; error: string }

function jsonBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value ?? {}), 'utf8')
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

function readText(value: unknown, maxLength: number, field: string, required = false) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (required && !text) return { ok: false as const, status: 400 as const, error: field === 'title' ? '请填写 Skill 名称' : '请填写 User 模板' }
  if (text.length > maxLength) return { ok: false as const, status: 400 as const, error: `${field} 过长` }
  return { ok: true as const, value: text || undefined }
}

function parseJsonField(value: unknown, maxBytes: number, invalidError: string, tooLargeError: string) {
  if (value == null || value === '') return { ok: true as const, value: undefined }
  if (jsonBytes(value) > maxBytes) return { ok: false as const, status: 413 as const, error: tooLargeError }
  if (typeof value !== 'string') return { ok: true as const, value }
  try {
    return { ok: true as const, value: JSON.parse(value) }
  } catch {
    return { ok: false as const, status: 400 as const, error: invalidError }
  }
}

export function normalizeSkillPromptSubmission(body: any): SkillPromptSubmission {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, error: '请求体必须是 JSON 对象' }
  }

  const title = readText(body.title, MAX_SKILL_TITLE_LENGTH, 'title', true)
  if (!title.ok) return title
  const promptTemplate = readText(body.promptTemplate, MAX_SKILL_PROMPT_TEMPLATE_LENGTH, 'promptTemplate', true)
  if (!promptTemplate.ok) return promptTemplate
  const description = readText(body.description, MAX_SKILL_DESCRIPTION_LENGTH, 'description')
  if (!description.ok) return description
  const systemPrompt = readText(body.systemPrompt, MAX_SKILL_SYSTEM_PROMPT_LENGTH, 'systemPrompt')
  if (!systemPrompt.ok) return systemPrompt
  const categorySlug = readText(body.categorySlug, MAX_SKILL_CATEGORY_SLUG_LENGTH, 'categorySlug')
  if (!categorySlug.ok) return categorySlug

  const inputSchema = parseJsonField(body.inputSchema, MAX_SKILL_SCHEMA_BYTES, '输入字段定义不是合法 JSON', '输入字段定义过大')
  if (!inputSchema.ok) return inputSchema
  const recommendedModels = parseJsonField(body.recommendedModels, MAX_SKILL_RECOMMENDED_MODELS_BYTES, '推荐模型不是合法 JSON', '推荐模型配置过大')
  if (!recommendedModels.ok) return recommendedModels

  return {
    ok: true,
    value: {
      title: title.value!,
      description: description.value,
      systemPrompt: systemPrompt.value,
      promptTemplate: promptTemplate.value!,
      inputSchema: inputSchema.value,
      recommendedModels: recommendedModels.value,
      categorySlug: categorySlug.value || '',
      idempotencyKey: body.idempotencyKey,
    },
  }
}
