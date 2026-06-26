import { getPayload } from 'payload'
import config from '@payload-config'
import { runnerFromBearer } from '@/lib/runnerAuth'

// GET /v1/runner/me —— Runner 用 Bearer 令牌验证登录归属（whoami）
export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const actor = await runnerFromBearer(payload, request)
  if (!actor) return Response.json({ error: '未登录或令牌无效' }, { status: 401 })

  // 刷新最近活跃时间（不阻塞）
  payload
    .update({
      collection: 'runner-clients',
      id: actor.runner.id,
      data: { lastSeenAt: new Date().toISOString() },
      overrideAccess: true,
    })
    .catch(() => {})

  return Response.json({
    user: { id: actor.user.id, username: actor.user.username },
    runnerId: actor.runner.runnerId,
    trustedLevel: actor.runner.trustedLevel || 'community',
  })
}
