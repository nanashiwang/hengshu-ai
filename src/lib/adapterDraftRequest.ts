export const MAX_ADAPTER_DRAFT_REQUEST_BYTES = 100_000
export const MAX_ADAPTER_DRAFT_TITLE_LENGTH = 120
export const MAX_ADAPTER_PROMPT_APPEND_LENGTH = 4_000
export const MAX_ADAPTER_JSON_PATCH_BYTES = 20_000

export type AdapterDraftOverridesResult =
  | { ok: true; overrides: Record<string, unknown> }
  | { ok: false; status: 400 | 413; error: string }

function jsonBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value ?? {}), 'utf8')
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

function readString(value: unknown, maxLength: number, field: string): { ok: true; value?: string } | { ok: false; error: string } {
  if (typeof value !== 'string') return { ok: true }
  const text = value.trim()
  if (!text) return { ok: true }
  if (text.length > maxLength) return { ok: false, error: `${field} 过长` }
  return { ok: true, value: text }
}

function readJsonPatch(value: unknown, field: string): { ok: true; value?: Record<string, unknown> } | { ok: false; status: 400 | 413; error: string } {
  if (value == null) return { ok: true }
  if (typeof value !== 'object' || Array.isArray(value)) return { ok: false, status: 400, error: `${field} 必须是 JSON 对象` }
  if (jsonBytes(value) > MAX_ADAPTER_JSON_PATCH_BYTES) return { ok: false, status: 413, error: `${field} 过大` }
  return { ok: true, value: value as Record<string, unknown> }
}

export function normalizeAdapterDraftOverrides(body: any): AdapterDraftOverridesResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, error: '请求体必须是 JSON 对象' }
  }

  const overrides: Record<string, unknown> = {}
  const title = readString(body.title, MAX_ADAPTER_DRAFT_TITLE_LENGTH, 'title')
  if (!title.ok) return { ok: false, status: 400, error: title.error }
  if (title.value) overrides.title = title.value

  const systemPromptAppend = readString(body.systemPromptAppend, MAX_ADAPTER_PROMPT_APPEND_LENGTH, 'systemPromptAppend')
  if (!systemPromptAppend.ok) return { ok: false, status: 400, error: systemPromptAppend.error }
  if (systemPromptAppend.value) overrides.systemPromptAppend = systemPromptAppend.value

  const userPromptAppend = readString(body.userPromptAppend, MAX_ADAPTER_PROMPT_APPEND_LENGTH, 'userPromptAppend')
  if (!userPromptAppend.ok) return { ok: false, status: 400, error: userPromptAppend.error }
  if (userPromptAppend.value) overrides.userPromptAppend = userPromptAppend.value

  const outputSchemaPatch = readJsonPatch(body.outputSchemaPatch, 'outputSchemaPatch')
  if (!outputSchemaPatch.ok) return outputSchemaPatch
  if (outputSchemaPatch.value) overrides.outputSchemaPatch = outputSchemaPatch.value

  const decodingPatch = readJsonPatch(body.decodingPatch, 'decodingPatch')
  if (!decodingPatch.ok) return decodingPatch
  if (decodingPatch.value) overrides.decodingPatch = decodingPatch.value

  return { ok: true, overrides }
}
