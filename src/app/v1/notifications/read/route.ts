import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'

// POST /v1/notifications/read —— 标记通知已读。body {id} 标一条，无 id 则标本用户全部未读。
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    /* 容忍空 body */
  }
  const id = typeof body.id === 'string' ? body.id : undefined

  try {
    if (id) {
      // 只能标记自己的
      const n = await payload.findByID({ collection: 'notifications', id, depth: 0, overrideAccess: true }).catch(() => null)
      const owner = n && (typeof (n as any).user === 'object' ? (n as any).user?.id : (n as any).user)
      if (!n || String(owner) !== String(user.id)) {
        return Response.json({ error: '通知不存在' }, { status: 404 })
      }
      await payload.update({ collection: 'notifications', id, data: { read: true }, overrideAccess: true })
    } else {
      await payload.update({
        collection: 'notifications',
        where: { and: [{ user: { equals: user.id } }, { read: { equals: false } }] },
        data: { read: true },
        overrideAccess: true,
      })
    }
    return Response.json({ ok: true })
  } catch (e) {
    payload.logger?.error(`标记通知已读失败: ${(e as Error).message}`)
    return Response.json({ error: '操作失败' }, { status: 500 })
  }
}
