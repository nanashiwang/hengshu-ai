import { getPayload } from 'payload'
import config from '@payload-config'
import { awardContribution } from '@/lib/contribution'

// POST /v1/auth/register —— 邀请码注册
export async function POST(request: Request) {
  const payload = await getPayload({ config })

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: '请求体无效' }, { status: 400 })
  }
  const { email, username, password, inviteCode } = body
  if (!email || !username || !password) {
    return Response.json({ error: '邮箱、用户名、密码均为必填' }, { status: 400 })
  }
  if (!inviteCode) {
    return Response.json({ error: '需要邀请码' }, { status: 400 })
  }

  // 校验邀请码
  const codes = await payload.find({
    collection: 'invite-codes',
    where: { code: { equals: String(inviteCode).trim().toUpperCase() } },
    limit: 1,
    overrideAccess: true,
  })
  const code = codes.docs[0]
  if (!code || code.status !== 'unused') {
    return Response.json({ error: '邀请码无效或已使用' }, { status: 400 })
  }
  if (code.expiresAt && new Date(code.expiresAt) < new Date()) {
    return Response.json({ error: '邀请码已过期' }, { status: 400 })
  }

  const inviterId = typeof code.inviter === 'object' ? code.inviter?.id : code.inviter

  // 建用户
  let newUser
  try {
    newUser = await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        email,
        username,
        password,
        role: 'user',
        invitedBy: inviterId || undefined,
      },
    })
  } catch (e: any) {
    return Response.json({ error: `注册失败：${e.message}` }, { status: 400 })
  }

  // 标记邀请码已用
  await payload.update({
    collection: 'invite-codes',
    id: code.id,
    overrideAccess: true,
    data: { status: 'used', usedBy: newUser.id },
  })

  // 给邀请人 +5 贡献值
  if (inviterId) {
    await awardContribution(payload, {
      userId: inviterId,
      actionType: 'invite',
      points: 5,
      description: '邀请新用户注册',
    })
  }

  return Response.json({ ok: true, userId: newUser.id })
}
