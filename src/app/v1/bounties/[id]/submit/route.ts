import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { notify } from '@/lib/notify'
import { canSubmitBounty, canUseSkillAsBountyDelivery } from '@/lib/bountyAccess'
import { isBountyRequestError, MAX_BOUNTY_REQUEST_BYTES, normalizeBountySkillSlug } from '@/lib/bountyRequest'
import { readJsonBodyWithLimit } from '@/lib/requestBody'

// POST /v1/bounties/{id}/submit  { skillSlug } —— 接单人提交交付的 Skill
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })

  const parsed = await readJsonBodyWithLimit(request, MAX_BOUNTY_REQUEST_BYTES, '悬赏提交请求体过大', { emptyValue: {} })
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const skillSlug = normalizeBountySkillSlug(parsed.value?.skillSlug)
  if (isBountyRequestError(skillSlug)) return Response.json({ error: skillSlug.error }, { status: skillSlug.status })

  const b = await payload.findByID({ collection: 'bounties', id, overrideAccess: true }).catch(() => null)
  if (!b) return Response.json({ error: '悬赏不存在' }, { status: 404 })
  const acceptedById = typeof b.acceptedBy === 'object' ? (b.acceptedBy as any)?.id : b.acceptedBy
  if (acceptedById !== user.id) return Response.json({ error: '只有接单人可提交' }, { status: 403 })
  if (!canSubmitBounty(b, user)) return Response.json({ error: '当前状态不可提交' }, { status: 400 })

  const skills = await payload.find({
    collection: 'skills',
    where: { slug: { equals: skillSlug } },
    limit: 1,
    overrideAccess: true,
  })
  const skill = skills.docs[0]
  if (!skill) return Response.json({ error: 'Skill 不存在' }, { status: 404 })
  // 交付物必须是接单人自己的公开已发布 Skill，避免拿他人 Skill 或不可见草稿冒充交付。
  if (!canUseSkillAsBountyDelivery(skill, user)) {
    return Response.json({ error: '只能提交你自己公开发布的 Skill 作为交付物' }, { status: 403 })
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
