import { normalizeExternalIdempotencyKey } from './idempotency'

export const MAX_BOUNTY_REQUEST_BYTES = 100_000
export const MAX_BOUNTY_TITLE_LENGTH = 120
export const MAX_BOUNTY_DESCRIPTION_LENGTH = 8_000
export const MAX_BOUNTY_SKILL_SLUG_LENGTH = 160
export const MAX_BOUNTY_REWARD_POINTS = 1_000_000

export type BountyRequestError = { ok: false; status: 400 | 413; error: string }

export function normalizeBountyCreate(body: any): {
  title: string
  description?: string
  rewardPoints: number
  dueAt?: string
  idempotencyKey?: string
} | BountyRequestError {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, error: '请求体必须是 JSON 对象' }
  }
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return { ok: false, status: 400, error: '请填写悬赏标题' }
  if (title.length > MAX_BOUNTY_TITLE_LENGTH) return { ok: false, status: 400, error: '悬赏标题过长' }

  const description = typeof body.description === 'string' ? body.description.trim() : ''
  if (description.length > MAX_BOUNTY_DESCRIPTION_LENGTH) return { ok: false, status: 400, error: '悬赏说明过长' }

  const rewardPoints = Math.floor(Number(body.rewardPoints) || 0)
  if (rewardPoints < 0 || rewardPoints > MAX_BOUNTY_REWARD_POINTS) {
    return { ok: false, status: 400, error: '悬赏贡献值无效' }
  }

  const dueAt = typeof body.dueAt === 'string' ? body.dueAt.trim() : ''
  if (dueAt && Number.isNaN(new Date(dueAt).getTime())) return { ok: false, status: 400, error: '截止时间无效' }

  return {
    title,
    description: description || undefined,
    rewardPoints,
    dueAt: dueAt || undefined,
    idempotencyKey: normalizeExternalIdempotencyKey(body.idempotencyKey) || undefined,
  }
}

export function normalizeBountySkillSlug(value: unknown): string | BountyRequestError {
  const slug = typeof value === 'string' ? value.trim() : ''
  if (!slug) return { ok: false, status: 400, error: '请提供交付的 Skill slug' }
  if (slug.length > MAX_BOUNTY_SKILL_SLUG_LENGTH) return { ok: false, status: 400, error: 'Skill slug 过长' }
  return slug
}

export function isBountyRequestError(value: unknown): value is BountyRequestError {
  return Boolean(value && typeof value === 'object' && (value as any).ok === false)
}
