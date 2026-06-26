import type { Payload } from 'payload'
import { randomBytes, randomUUID } from 'crypto'

// 生成不可猜的随机令牌（url-safe）
export function randomToken(bytes = 36): string {
  return randomBytes(bytes).toString('base64url')
}

export function newRunnerId(): string {
  return randomUUID()
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

  const res = await payload.find({
    collection: 'runner-clients',
    where: { token: { equals: token } },
    limit: 1,
    overrideAccess: true,
  })
  const runner = res.docs[0]
  if (!runner) return null

  const userId = typeof runner.user === 'object' ? runner.user?.id : runner.user
  const user = await payload
    .findByID({ collection: 'users', id: userId, overrideAccess: true })
    .catch(() => null)
  if (!user) return null
  return { user, runner }
}
