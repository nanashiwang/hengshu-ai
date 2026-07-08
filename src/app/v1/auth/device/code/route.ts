import { getPayload } from 'payload'
import config from '@payload-config'
import { genUserCode, randomToken } from '@/lib/runnerAuth'
import { getClientIp, hashIp } from '@/lib/clientMeta'
import { getServerUrl } from '@/lib/siteUrl'
import { resolveRuntimeEnv } from '@/lib/deploymentSettings'
import { readJsonBodyWithLimit } from '@/lib/requestBody'
import { isDeviceAuthError, MAX_DEVICE_AUTH_REQUEST_BYTES, normalizeDeviceCodeMeta } from '@/lib/deviceAuthRequest'

// POST /v1/auth/device/code —— Runner 申请设备码（无需登录）
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const runtimeEnv = await resolveRuntimeEnv(payload)
  const parsed = await readJsonBodyWithLimit(request, MAX_DEVICE_AUTH_REQUEST_BYTES, '设备码请求体过大', { emptyValue: {} })
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const meta = normalizeDeviceCodeMeta(parsed.value)
  if (isDeviceAuthError(meta)) return Response.json({ error: meta.error }, { status: meta.status })

  const ipHashValue = hashIp(getClientIp(request.headers, runtimeEnv))
  if (ipHashValue) {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const recent = await payload.count({
      collection: 'device-codes',
      where: { and: [{ ipHash: { equals: ipHashValue } }, { createdAt: { greater_than_equal: since } }] },
      overrideAccess: true,
    })
    if (recent.totalDocs >= 20) {
      return Response.json({ error: '设备码申请过于频繁，请稍后再试' }, { status: 429 })
    }
  }

  const deviceCode = randomToken(40)
  const userCode = genUserCode()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  await payload.create({
    collection: 'device-codes',
    overrideAccess: true,
    data: {
      deviceCode,
      userCode,
      status: 'pending',
      meta,
      ipHash: ipHashValue || undefined,
      expiresAt,
    },
  })

  const base = getServerUrl(runtimeEnv)
  return Response.json({
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: `${base}/device`,
    expires_in: 600,
    interval: 3,
  })
}
