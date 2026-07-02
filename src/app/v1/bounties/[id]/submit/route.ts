import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { notify } from '@/lib/notify'

// POST /v1/bounties/{id}/submit  { skillSlug } —— 接单人提交交付的 Skill
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    /* noop */
  }
  const skillSlug = String(body.skillSlug || '').trim()
  if (!skillSlug) return Response.json({ error: '请提供交付的 Skill slug' }, { status: 400 })

  const b = await payload.findByID({ collection: 'bounties', id, overrideAccess: true }).catch(() => null)
  if (!b) return Response.json({ error: '悬赏不存在' }, { status: 404 })
  const acceptedById = typeof b.acceptedBy === 'object' ? (b.acceptedBy as any)?.id : b.acceptedBy
  if (acceptedById !== user.id) return Response.json({ error: '只有接单人可提交' }, { status: 403 })
  if (b.status !== 'accepted') return Response.json({ error: '当前状态不可提交' }, { status: 400 })

  const skills = await payload.find({
    collection: 'skills',
    where: { slug: { equals: skillSlug } },
    limit: 1,
    overrideAccess: true,
  })
  const skill = skills.docs[0]
  if (!skill) return Response.json({ error: 'Skill 不存在' }, { status: 404 })
  // 归属校验：只能用接单人自己的作品交付，杜绝拿他人热门 Skill 冒充交付换赏金
  const skillAuthorId = typeof skill.author === 'object' ? (skill.author as any)?.id : skill.author
  if (String(skillAuthorId) !== String(user.id)) {
    return Response.json({ error: '只能提交你自己创作的 Skill 作为交付物' }, { status: 403 })
  }

  await payload.update({
    collection: 'bounties',
    id,
    data: { status: 'submitted', submittedSkill: skill.id },
    overrideAccess: true,
  })
  const creatorId = typeof b.creator === 'object' ? (b.creator as any)?.id : b.creator
  await notify(payload, {
    userId: creatorId,
    type: 'bounty_submitted',
    title: `悬赏「${b.title}」已提交交付，待你验收`,
    link: `/bounties/${id}`,
    relatedBounty: id,
    actorId: user.id as string,
  })
  return Response.json({ ok: true })
}
