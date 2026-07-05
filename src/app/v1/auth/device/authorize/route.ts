import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { newRunnerId, randomToken, runnerTokenExpiresAt, runnerTokenHash } from '@/lib/runnerAuth'
import { metaWithPendingAccessToken } from '@/lib/deviceAuth'

// POST /v1/auth/device/authorize —— 已登录用户在 /device 页授权某个设备码
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: '请求体无效' }, { status: 400 })
  }
  const userCode = String(body.userCode || '').trim().toUpperCase()
  if (!userCode) return Response.json({ error: '请输入设备码' }, { status: 400 })

  const codes = await payload.find({
    collection: 'device-codes',
    where: { and: [{ userCode: { equals: userCode } }, { status: { equals: 'pending' } }] },
    limit: 1,
    overrideAccess: true,
  })
  const code = codes.docs[0]
  if (!code) return Response.json({ error: '设备码无效或已被使用' }, { status: 404 })
  if (code.expiresAt && new Date(code.expiresAt) < new Date()) {
    await payload.update({ collection: 'device-codes', id: code.id, overrideAccess: true, data: { status: 'denied' } })
    return Response.json({ error: '设备码已过期' }, { status: 400 })
  }

  const meta = (code.meta || {}) as any
  if (!body.confirm) {
    return Response.json({
      requiresConfirmation: true,
      device: {
        runnerVersion: meta.runnerVersion || null,
        os: meta.os || null,
        arch: meta.arch || null,
        label: meta.label || null,
        expiresAt: code.expiresAt || null,
      },
    })
  }

  // 创建 Runner 实例：只落令牌哈希；原始令牌短暂放在 device-code.meta，Runner 轮询后即消费
  const runnerToken = randomToken(48)
  const runner = await payload.create({
    collection: 'runner-clients',
    overrideAccess: true,
    data: {
      user: user.id,
      runnerId: newRunnerId(),
      tokenHash: runnerTokenHash(runnerToken),
      tokenExpiresAt: runnerTokenExpiresAt(),
      runnerVersion: meta.runnerVersion,
      os: meta.os,
      arch: meta.arch,
      lastSeenAt: new Date().toISOString(),
    },
  })
  await payload.update({
    collection: 'device-codes',
    id: code.id,
    overrideAccess: true,
    data: { status: 'authorized', user: user.id, runnerClient: runner.id, meta: metaWithPendingAccessToken(meta, runnerToken) },
  })

  return Response.json({ ok: true })
}
