import type { Payload } from 'payload'
import { randomBytes, randomUUID } from 'crypto'
import { hmacDigest } from './secrets'

// 生成不可猜的随机令牌（url-safe）
export function randomToken(bytes = 36): string {
  return randomBytes(bytes).toString('base64url')
}

export function newRunnerId(): string {
  return randomUUID()
}

export function runnerTokenHash(token: string): string {
  return hmacDigest(token, 'runner-token')
}

export function runnerTokenExpiresAt(): string {
  const days = Math.max(1, Number(process.env.RUNNER_TOKEN_TTL_DAYS || 90))
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

export function allowLegacyRunnerTokenAuth(): boolean {
  return process.env.ALLOW_LEGACY_RUNNER_TOKEN_AUTH === '1' || process.env.NODE_ENV !== 'production'
}

// 人类可输入的设备授权码，形如 ABCD-7K9M（去除易混字符）
export function genUserCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 8; i++) s += chars[randomBytes(1)[0] % chars.length]
  return `${s.slice(0, 4)}-${s.slice(4)}`
}

export interface RunnerActor {
  user: any
  runner: any
}

// 从 Authorization: Bearer <runner-token> 解析出归属用户与 Runner 实例
export async function runnerFromBearer(
  payload: Payload,
  request: Request,
): Promise<RunnerActor | null> {
  const auth = request.headers.get('authorization') || ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (!m) return null
  const token = m[1].trim()
  if (!token) return null

  const tokenHash = runnerTokenHash(token)
  const where: any = allowLegacyRunnerTokenAuth()
    ? { or: [{ tokenHash: { equals: tokenHash } }, { token: { equals: token } }] }
    : { tokenHash: { equals: tokenHash } }
  const res = await payload.find({
    collection: 'runner-clients',
    where,
    limit: 1,
    overrideAccess: true,
  })
  const runner = res.docs[0]
  if (!runner) return null
  if (runner.tokenExpiresAt && new Date(runner.tokenExpiresAt) < new Date()) return null

  // 开发/迁移期兼容旧明文 token，一旦命中就自愈为 hash 并清掉明文；生产默认不走此分支。
  if (allowLegacyRunnerTokenAuth() && (runner as any).token === token) {
    payload
      .update({
        collection: 'runner-clients',
        id: runner.id,
        data: {
          tokenHash: (runner as any).tokenHash || tokenHash,
          tokenExpiresAt: (runner as any).tokenExpiresAt || runnerTokenExpiresAt(),
          token: null,
        },
        overrideAccess: true,
      })
      .catch((e) => payload.logger?.error(`Runner legacy token 自愈失败: ${(e as Error).message}`))
  }

  const userId = typeof runner.user === 'object' ? runner.user?.id : runner.user
  const user = await payload
    .findByID({ collection: 'users', id: userId, overrideAccess: true })
    .catch(() => null)
  if (!user || (user as any).accountStatus === 'banned') return null
  return { user, runner }
}
