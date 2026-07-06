import { getPayload } from 'payload'
import config from '@payload-config'
import { findStoredSkillPackage } from '@/lib/skillPackage'

// GET /v1/skills/{slug}/package —— 下载审核通过后冻结的 Skill 压缩包。
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const skills = await payload.find({
    collection: 'skills',
    where: { slug: { equals: slug } },
    depth: 2,
    limit: 1,
    overrideAccess: true,
  })
  const skill = skills.docs[0] as any
  if (!skill || skill.status !== 'published' || skill.visibility !== 'public') {
    return Response.json({ error: 'Skill 不存在或不可下载' }, { status: 404 })
  }

  let version: any = skill.currentVersion
  if (!version || typeof version === 'string') {
    version = (
      await payload.find({
        collection: 'skill-versions',
        where: { skill: { equals: skill.id } },
        sort: '-createdAt',
        limit: 1,
        overrideAccess: true,
      })
    ).docs[0]
  }
  if (!version?.id) return Response.json({ error: '无可用版本' }, { status: 400 })

  const pkg = await findStoredSkillPackage(String(skill.id), String(version.id))
  if (!pkg) return Response.json({ error: 'Skill 包不存在' }, { status: 404 })

  payload
    .update({
      collection: 'skills',
      id: skill.id as string,
      data: { downloadCount: ((skill as any).downloadCount || 0) + 1 },
      overrideAccess: true,
    })
    .catch(() => {})

  const ext = pkg.filename.endsWith('.zip') ? 'zip' : 'tar.gz'
  return new Response(pkg.buffer, {
    headers: {
      'Content-Type': pkg.type,
      'Content-Disposition': `attachment; filename="${skill.slug}-${version.version || '1.0.0'}.${ext}"`,
      'Content-Length': String(pkg.size),
      'X-Hengshu-Checksum': pkg.checksum,
      'Cache-Control': 'no-store',
    },
  })
}
