import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { notify } from '@/lib/notify'

// POST /v1/bounties/{id}/accept —— 创作者认领悬赏
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })

  const b = await payload.findByID({ collection: 'bounties', id, overrideAccess: true }).catch(() => null)
  if (!b) return Response.json({ error: '悬赏不存在' }, { status: 404 })
  const creatorId = typeof b.creator === 'object' ? (b.creator as any)?.id : b.creator
  if (creatorId === user.id) return Response.json({ error: '不能认领自己的悬赏' }, { status: 400 })
  if (b.status !== 'open') return Response.json({ error: '悬赏当前不可认领' }, { status: 400 })

  await payload.update({
    collection: 'bounties',
    id,
    data: { status: 'accepted', acceptedBy: user.id },
    overrideAccess: true,
  })
  await notify(payload, {
    userId: creatorId,
    type: 'bounty_accepted',
    title: `你的悬赏「${b.title}」被认领了`,
    link: `/bounties/${id}`,
    relatedBounty: id,
    actorId: user.id as string,
  })
  return Response.json({ ok: true })
}
