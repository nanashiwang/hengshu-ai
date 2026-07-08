import { ROUTE_MODES, type RouteMode } from './constants'

export const MAX_SKILL_RUN_REQUEST_BYTES = 200_000
export const MAX_SKILL_RUN_INPUT_BYTES = 120_000
export const MAX_COMPARE_MODELS = 4
export const MAX_MODEL_NAME_LENGTH = 160
export const MAX_MODEL_PROVIDER_LENGTH = 80
export const MAX_MODEL_VERSION_LENGTH = 160

export type SkillRunRequestValidation =
  | { ok: true }
  | { ok: false; status: 400 | 413; error: string }
export type SkillRunRequestError = Exclude<SkillRunRequestValidation, { ok: true }>

function jsonBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value ?? {}), 'utf8')
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

export function validateSkillRunInput(input: unknown): SkillRunRequestValidation {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, status: 400, error: 'input 必须是 JSON 对象' }
  }
  if (jsonBytes(input) > MAX_SKILL_RUN_INPUT_BYTES) {
    return { ok: false, status: 413, error: 'input 过大' }
  }
  return { ok: true }
}

export function normalizeRunInput(body: any): Record<string, unknown> | SkillRunRequestError {
  const input = body?.input ?? {}
  const valid = validateSkillRunInput(input)
  return valid.ok ? input as Record<string, unknown> : valid
}

export function normalizeCompareModels(value: unknown): string[] | SkillRunRequestError {
  const raw = Array.isArray(value) ? value : []
  const models = [...new Set(raw.map((m) => String(m || '').trim()).filter(Boolean))]
  if (models.some((m) => m.length > MAX_MODEL_NAME_LENGTH)) {
    return { ok: false, status: 400, error: '模型名称过长' }
  }
  return models.slice(0, MAX_COMPARE_MODELS)
}

export function normalizeRerunModel(value: unknown): string | SkillRunRequestError {
  const model = typeof value === 'string' ? value.trim() : ''
  if (!model) return { ok: false, status: 400, error: '请选择要重跑的模型' }
  if (model.length > MAX_MODEL_NAME_LENGTH) return { ok: false, status: 400, error: '模型名称过长' }
  return model
}

export function normalizeOptionalModelProvider(value: unknown): string | undefined | SkillRunRequestError {
  if (value == null || value === '') return undefined
  const provider = String(value).trim()
  if (!provider) return undefined
  if (provider.length > MAX_MODEL_PROVIDER_LENGTH) return { ok: false, status: 400, error: '模型 Provider 过长' }
  return provider
}

export function normalizeOptionalModelVersion(value: unknown): string | undefined | SkillRunRequestError {
  if (value == null || value === '') return undefined
  const version = String(value).trim()
  if (!version) return undefined
  if (version.length > MAX_MODEL_VERSION_LENGTH) return { ok: false, status: 400, error: '模型版本过长' }
  return version
}

export function normalizeRouteMode(value: unknown): RouteMode | undefined | SkillRunRequestError {
  if (value == null || value === '') return undefined
  const mode = String(value).trim()
  if ((ROUTE_MODES as readonly string[]).includes(mode)) return mode as RouteMode
  return { ok: false, status: 400, error: 'routeMode 无效' }
}

export function isValidationError(value: unknown): value is SkillRunRequestError {
  return Boolean(value && typeof value === 'object' && (value as any).ok === false)
}
