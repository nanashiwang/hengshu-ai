import { getPayload } from 'payload'
import config from '@payload-config'
import { resolvePublishedSkill } from '@/lib/installs'
import { findStoredSkillPackage } from '@/lib/skillPackage'

// GET /v1/skills/{slug}/package —— 下载审核通过后冻结的 Skill 压缩包。
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const resolved = await resolvePublishedSkill(payload, slug)
  if (!resolved) {
    return Response.json({ error: 'Skill 不存在或不可下载' }, { status: 404 })
  }
  const { skill, version } = resolved

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
