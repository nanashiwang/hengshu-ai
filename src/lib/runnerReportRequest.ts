export const MAX_RUNNER_REPORT_REQUEST_BYTES = 100_000
export const MAX_RUNNER_REPORT_SLUG_LENGTH = 160
export const MAX_RUNNER_REPORT_MODEL_LENGTH = 160
export const MAX_RUNNER_REPORT_PROVIDER_LENGTH = 80
export const MAX_RUNNER_REPORT_VERSION_LENGTH = 80
export const MAX_RUNNER_REPORT_ERROR_TYPE_LENGTH = 80
export const MAX_RUNNER_REPORT_BUCKET_LENGTH = 32
export const MAX_RUNNER_REPORT_LATENCY_MS = 10 * 60 * 1000

export type NormalizedRunnerCompatReport = {
  slug: string
  checksum?: string
  anon: boolean
  modelName: string
  modelProvider?: string
  modelVersion?: string
  success: boolean
  latencyMs?: number
  formatValid: boolean
  errorType?: string
  inputSizeBucket?: string
  outputSizeBucket?: string
}

export type RunnerReportValidation =
  | { ok: true; value: NormalizedRunnerCompatReport }
  | { ok: false; status: 400 | 413; error: string }

function readLimitedString(value: unknown, maxLength: number): string | null {
  if (value == null) return ''
  const text = String(value).trim()
  return text.length > maxLength ? null : text
}

function readOptionalLimitedString(value: unknown, maxLength: number): string | undefined | null {
  const text = readLimitedString(value, maxLength)
  if (text == null) return null
  return text || undefined
}

function readLatency(value: unknown): number | undefined | null {
  if (value == null || value === '') return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value < 0 || value > MAX_RUNNER_REPORT_LATENCY_MS) return null
  return Math.round(value)
}

export function normalizeRunnerCompatReport(body: any): RunnerReportValidation {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, error: '请求体必须是 JSON 对象' }
  }

  const slug = readLimitedString(body.slug, MAX_RUNNER_REPORT_SLUG_LENGTH)
  const modelName = readLimitedString(body.model, MAX_RUNNER_REPORT_MODEL_LENGTH)
  if (slug == null || modelName == null) return { ok: false, status: 400, error: 'slug 或 model 过长' }
  if (!slug || !modelName) return { ok: false, status: 400, error: '缺少 slug 或 model' }

  const checksum = readOptionalLimitedString(body.checksum, 160)
  const modelProvider = readOptionalLimitedString(body.modelProvider, MAX_RUNNER_REPORT_PROVIDER_LENGTH)
  const modelVersion = readOptionalLimitedString(body.modelVersion, MAX_RUNNER_REPORT_VERSION_LENGTH)
  const errorType = readOptionalLimitedString(body.errorType, MAX_RUNNER_REPORT_ERROR_TYPE_LENGTH)
  const inputSizeBucket = readOptionalLimitedString(body.inputSizeBucket, MAX_RUNNER_REPORT_BUCKET_LENGTH)
  const outputSizeBucket = readOptionalLimitedString(body.outputSizeBucket, MAX_RUNNER_REPORT_BUCKET_LENGTH)
  if ([checksum, modelProvider, modelVersion, errorType, inputSizeBucket, outputSizeBucket].some((v) => v === null)) {
    return { ok: false, status: 400, error: '兼容报告字段过长' }
  }

  const latencyMs = readLatency(body.latencyMs)
  if (latencyMs === null) return { ok: false, status: 400, error: 'latencyMs 无效' }

  return {
    ok: true,
    value: {
      slug,
      checksum: checksum || undefined,
      anon: Boolean(body.anon),
      modelName,
      modelProvider: modelProvider || undefined,
      modelVersion: modelVersion || undefined,
      success: Boolean(body.success),
      latencyMs,
      formatValid: Boolean(body.formatValid),
      errorType: errorType || undefined,
      inputSizeBucket: inputSizeBucket || undefined,
      outputSizeBucket: outputSizeBucket || undefined,
    },
  }
}
