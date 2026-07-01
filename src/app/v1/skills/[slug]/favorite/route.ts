import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'

// POST /v1/skills/{slug}/favorite —— 切换收藏
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })

  const skills = await payload.find({
    collection: 'skills',
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: false,
    user,
  })
  const skill = skills.docs[0]
  if (!skill) return Response.json({ error: 'Skill 不存在' }, { status: 404 })

  const existing = await payload.find({
    collection: 'favorites',
    where: { and: [{ user: { equals: user.id } }, { skill: { equals: skill.id } }] },
    limit: 1,
    overrideAccess: true,
  })

  if (existing.docs[0]) {
    await payload.delete({ collection: 'favorites', id: existing.docs[0].id, overrideAccess: true })
    return Response.json({ favorited: false })
  }

  try {
    await payload.create({
      collection: 'favorites',
      data: { user: user.id, skill: skill.id },
      overrideAccess: true,
    })
  } catch (e) {
    // 复合唯一约束兜底：仅当确已存在（并发/重复）才视为已收藏，其它真错误照抛
    const again = await payload.find({
      collection: 'favorites',
      where: { and: [{ user: { equals: user.id } }, { skill: { equals: skill.id } }] },
      limit: 1,
      overrideAccess: true,
    })
    if (again.docs[0]) return Response.json({ favorited: true })
    throw e
  }
  return Response.json({ favorited: true })
}
