export const MAX_RUNNER_COMMAND_REQUEST_BYTES = 50_000
export const MAX_RUNNER_SLUG_LENGTH = 160
export const MAX_RUNNER_CHECK_ITEMS = 100
export const MAX_RUNNER_CHECKSUM_LENGTH = 160
const SAFE_RUNNER_SLUG = /^[a-z0-9\u3400-\u4dbf\u4e00-\u9fff](?:[a-z0-9\u3400-\u4dbf\u4e00-\u9fff._-]{0,158}[a-z0-9\u3400-\u4dbf\u4e00-\u9fff])?$/i
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i

export type RunnerCommandError = { ok: false; status: 400 | 413; error: string }

export function normalizeRunnerSlug(value: unknown): string | RunnerCommandError {
  const slug = typeof value === 'string' ? value.trim().normalize('NFKC').toLowerCase() : ''
  if (!slug) return { ok: false, status: 400, error: '缺少 slug' }
  if (slug.length > MAX_RUNNER_SLUG_LENGTH) return { ok: false, status: 400, error: 'slug 过长' }
  if (!SAFE_RUNNER_SLUG.test(slug) || WINDOWS_RESERVED_NAME.test(slug)) {
    return { ok: false, status: 400, error: 'slug 格式非法' }
  }
  return slug
}

export function normalizeRunnerCheckItems(value: unknown): Array<{ slug: string; checksum?: string }> | RunnerCommandError {
  const raw = Array.isArray(value) ? value : []
  if (raw.length > MAX_RUNNER_CHECK_ITEMS) return { ok: false, status: 413, error: '检查项过多' }
  const out: Array<{ slug: string; checksum?: string }> = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const slug = normalizeRunnerSlug((item as any).slug)
    if (isRunnerCommandError(slug)) return slug
    const checksum = typeof (item as any).checksum === 'string' ? (item as any).checksum.trim() : ''
    if (checksum.length > MAX_RUNNER_CHECKSUM_LENGTH) {
      return { ok: false, status: 400, error: 'checksum 过长' }
    }
    out.push({ slug, checksum: checksum || undefined })
  }
  return out
}

export function isRunnerCommandError(value: unknown): value is RunnerCommandError {
  return Boolean(value && typeof value === 'object' && (value as any).ok === false)
}
