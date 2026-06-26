import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { newRunnerId, randomToken } from '@/lib/runnerAuth'

// POST /v1/auth/device/authorize —— 已登录用户在 /device 页授权某个设备码
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })

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

  // 创建 Runner 实例（带访问令牌）并标记设备码已授权
  const meta = (code.meta || {}) as any
  const runner = await payload.create({
    collection: 'runner-clients',
    overrideAccess: true,
    data: {
      user: user.id,
      runnerId: newRunnerId(),
      token: randomToken(48),
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
    data: { status: 'authorized', user: user.id, runnerClient: runner.id },
  })

  return Response.json({ ok: true })
}
