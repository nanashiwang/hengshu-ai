import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { canReadSkillEvidence } from '@/lib/skillEvidenceAccess'
import { publicSkillContract } from '@/lib/skillContractPublic'
import { resolveCurrentSkillVersionForPublicEvidence } from '@/lib/skillVersionPublic'

// GET /v1/skills/{slug}/contract —— 公开/作者预览读取能力契约摘要；不暴露 prompt 正文。
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() }).catch(() => ({ user: null }))
  const skills = await payload.find({
    collection: 'skills',
    where: { slug: { equals: slug } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const skill = skills.docs[0] as any
  if (!canReadSkillEvidence(skill, user)) {
    return Response.json({ error: 'Skill 不存在或不可公开' }, { status: 404 })
  }

  const version = await resolveCurrentSkillVersionForPublicEvidence(payload, skill)
  if (!version) return Response.json({ error: 'Skill 尚无可公开版本' }, { status: 404 })

  return Response.json({
    skill: { id: String(skill.id), slug: String(skill.slug), title: String(skill.title) },
    contract: publicSkillContract(version, { slug: skill.slug }),
  })
}
