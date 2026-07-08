import type { Payload } from 'payload'

function relationId(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'object' && 'id' in value) return String((value as { id?: unknown }).id || '') || null
  return String(value)
}

export function isInstallablePublishedSkillVersion(skill: any, version: any) {
  if (!skill || skill.status !== 'published' || skill.visibility !== 'public') return false
  if (!version || version.status === 'deprecated') return false
  const versionSkillId = relationId(version.skill)
  return Boolean(versionSkillId && versionSkillId === String(skill.id))
}

// 解析一个已发布公开 Skill 及其当前版本
export async function resolvePublishedSkill(payload: Payload, slug: string) {
  const skills = await payload.find({
    collection: 'skills',
    where: { slug: { equals: slug } },
    depth: 2,
    limit: 1,
    overrideAccess: true,
  })
  const skill = skills.docs[0] as any
  if (!skill || skill.status !== 'published' || skill.visibility !== 'public') return null

  let version: any = skill.currentVersion
  if (!version || typeof version === 'string') {
    if (version) {
      version = await payload
        .findByID({ collection: 'skill-versions', id: String(version), depth: 0, overrideAccess: true })
        .catch(() => null)
    }
    if (!version) {
      version = (
        await payload.find({
          collection: 'skill-versions',
          where: { and: [{ skill: { equals: skill.id } }, { status: { equals: 'active' } }] },
          sort: '-createdAt',
          limit: 1,
          overrideAccess: true,
        })
      ).docs[0]
    }
  }
  if (!isInstallablePublishedSkillVersion(skill, version)) return null
  return { skill, version }
}

function refId(v: unknown): string | null {
  return relationId(v)
}

export function installedRecordNeedsRunner(data: Record<string, unknown> = {}, originalDoc?: Record<string, unknown> | null): boolean {
  const status = String((data.status ?? originalDoc?.status ?? 'installed') || 'installed')
  const runner = data.runner !== undefined ? data.runner : originalDoc?.runner
  return status === 'installed' && !refId(runner)
}

// 幂等 upsert 安装记录（唯一 user + skill + runner）
export async function upsertInstall(
  payload: Payload,
  args: {
    userId: string
    skillId: string
    versionId?: string
    runnerId: string
    version?: string
    checksum?: string
  },
) {
  const { userId, skillId, versionId, runnerId, version, checksum } = args
  if (!runnerId) throw new Error('安装记录必须绑定 Runner')
  const now = new Date().toISOString()
  const where: any = {
    and: [{ user: { equals: userId } }, { skill: { equals: skillId } }, { runner: { equals: runnerId } }],
  }

  const existing = await payload.find({
    collection: 'skill-installs',
    where,
    limit: 1,
    overrideAccess: true,
  })

  const data: any = {
    user: userId,
    skill: skillId,
    skillVersion: versionId,
    runner: runnerId,
    installedVersion: version,
    installedChecksum: checksum,
    status: 'installed',
    lastUsedAt: now,
  }

  if (existing.docs[0]) {
    return payload.update({
      collection: 'skill-installs',
      id: existing.docs[0].id,
      data,
      overrideAccess: true,
    })
  }
  try {
    return await payload.create({
      collection: 'skill-installs',
      overrideAccess: true,
      data: { ...data, installedAt: now },
    })
  } catch (e) {
    // 复合唯一约束兜底：并发下已被另一次创建 → 回查并更新
    const again = await payload.find({
      collection: 'skill-installs',
      where,
      limit: 1,
      overrideAccess: true,
    })
    if (again.docs[0]) {
      return payload.update({
        collection: 'skill-installs',
        id: again.docs[0].id,
        data,
        overrideAccess: true,
      })
    }
    throw e
  }
}

export async function findInstall(
  payload: Payload,
  userId: string,
  skillId: string,
  runnerId: string,
) {
  const where: any = { and: [{ user: { equals: userId } }, { skill: { equals: skillId } }] }
  if (runnerId) where.and.push({ runner: { equals: runnerId } })
  const res = await payload.find({ collection: 'skill-installs', where, limit: 1, overrideAccess: true })
  return res.docs[0] as any
}

export async function findActiveInstall(
  payload: Payload,
  userId: string,
  skillId: string,
  runnerId: string,
) {
  if (!runnerId) return null
  const res = await payload.find({
    collection: 'skill-installs',
    where: {
      and: [
        { user: { equals: userId } },
        { skill: { equals: skillId } },
        { runner: { equals: runnerId } },
        { status: { equals: 'installed' } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  })
  return (res.docs[0] as any) || null
}

export function activeInstallMatchesCurrentVersion(
  install: any,
  version: any,
  reportChecksum?: unknown,
) {
  if (!install || install.status !== 'installed' || !version?.id) return false
  const installedVersionId = relationId(install.skillVersion)
  if (installedVersionId && installedVersionId !== String(version.id)) return false

  const installedVersion = String(install.installedVersion || '').trim()
  if (!installedVersionId && installedVersion && version.version && installedVersion !== String(version.version)) return false

  const installedChecksum = String(install.installedChecksum || '').trim()
  if (!installedChecksum) return false
  return String(reportChecksum || '').trim() === installedChecksum
}
