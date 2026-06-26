import { getPayload } from 'payload'
import config from '@payload-config'
import { genUserCode, randomToken } from '@/lib/runnerAuth'

// POST /v1/auth/device/code —— Runner 申请设备码（无需登录）
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  let body: any = {}
  try {
    body = await request.json()
  } catch {
    /* 容忍空 body */
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
      meta: { runnerVersion: body.runnerVersion, os: body.os, arch: body.arch },
      expiresAt,
    },
  })

  const base = (process.env.NEXT_PUBLIC_SERVER_URL || '').replace(/\/$/, '')
  return Response.json({
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: `${base}/device`,
    expires_in: 600,
    interval: 3,
  })
}
