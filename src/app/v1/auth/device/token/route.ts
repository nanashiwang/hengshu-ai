import { getPayload } from 'payload'
import config from '@payload-config'

// POST /v1/auth/device/token —— Runner 轮询换取访问令牌
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  let body: any = {}
  try {
    body = await request.json()
  } catch {
    /* noop */
  }
  const deviceCode = String(body.device_code || '').trim()
  if (!deviceCode) return Response.json({ error: 'invalid_request' }, { status: 400 })

  const codes = await payload.find({
    collection: 'device-codes',
    where: { deviceCode: { equals: deviceCode } },
    limit: 1,
    overrideAccess: true,
  })
  const code = codes.docs[0]
  if (!code) return Response.json({ error: 'invalid_device_code' }, { status: 400 })
  if (code.expiresAt && new Date(code.expiresAt) < new Date()) {
    return Response.json({ error: 'expired_token' }, { status: 400 })
  }
  if (code.status === 'pending') {
    return Response.json({ status: 'authorization_pending' }, { status: 202 })
  }
  if (code.status !== 'authorized') {
    return Response.json({ error: 'access_denied' }, { status: 400 })
  }

  const rcId = typeof code.runnerClient === 'object' ? code.runnerClient?.id : code.runnerClient
  if (!rcId) return Response.json({ error: 'server_error' }, { status: 500 })
  const rc = await payload
    .findByID({ collection: 'runner-clients', id: rcId, overrideAccess: true, depth: 0 })
    .catch(() => null)
  if (!rc) return Response.json({ error: 'server_error' }, { status: 500 })

  // 单次消费：发出 token 后标记 consumed
  await payload.update({
    collection: 'device-codes',
    id: code.id,
    overrideAccess: true,
    data: { status: 'consumed' },
  })

  return Response.json({ access_token: (rc as any).token, runner_id: (rc as any).runnerId })
}
