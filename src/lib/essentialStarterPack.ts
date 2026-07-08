import type { Payload } from 'payload'

export type EssentialStarterPackEntry = {
  skill: any
  reason?: string | null
  starterExample?: unknown
  order: number
}

function relationId(value: unknown): string | undefined {
  if (!value) return undefined
  if (typeof value === 'object') return String((value as any).id || '') || undefined
  return String(value)
}

function isPublicSkill(skill: any) {
  return skill?.status === 'published' && skill?.visibility === 'public'
}

function cleanReason(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, 500) : null
}

export async function configuredEssentialStarterPack(payload: Payload): Promise<EssentialStarterPackEntry[]> {
  const settings = await payload
    .findGlobal({ slug: 'site-settings' as any, depth: 1, overrideAccess: true } as any)
    .catch(() => null) as any
  const rows = Array.isArray(settings?.essentialStarterPack) ? settings.essentialStarterPack : []
  const entries: EssentialStarterPackEntry[] = []
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index] || {}
    const skillRef = row.skill
    const skillId = relationId(skillRef)
    if (!skillId) continue
    const skill = typeof skillRef === 'object' && skillRef.id
      ? skillRef
      : await payload.findByID({ collection: 'skills' as any, id: skillId, depth: 1, overrideAccess: true }).catch(() => null)
    if (!isPublicSkill(skill)) continue
    entries.push({
      skill,
      reason: cleanReason(row.reason),
      starterExample: row.starterExample,
      order: Number.isFinite(Number(row.order)) ? Number(row.order) : index,
    })
  }
  return entries.sort((a, b) => a.order - b.order || String(a.skill?.title || '').localeCompare(String(b.skill?.title || '')))
}

export async function resolveEssentialStarterPack(
  payload: Payload,
  args: {
    q?: string
    categoryId?: string
    limit?: number
    page?: number
    sort?: string
  } = {},
) {
  const limit = Math.min(Math.max(Number(args.limit || 50), 1), 200)
  const page = Math.max(Number(args.page || 1), 1)
  const configured = await configuredEssentialStarterPack(payload)
  if (configured.length > 0) {
    const q = String(args.q || '').trim().toLowerCase()
    const filtered = configured.filter((entry) => {
      const skill = entry.skill
      if (args.categoryId && relationId(skill?.category) !== args.categoryId) return false
      if (q) {
        const haystack = `${skill?.title || ''} ${skill?.description || ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
    const start = (page - 1) * limit
    const docs = filtered.slice(start, start + limit)
    return {
      configured: true,
      totalDocs: filtered.length,
      page,
      totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
      limit,
      entries: docs,
    }
  }

  const and: any[] = [
    { status: { equals: 'published' } },
    { visibility: { equals: 'public' } },
    { isEssential: { equals: true } },
  ]
  if (args.categoryId) and.push({ category: { equals: args.categoryId } })
  if (args.q) and.push({ title: { like: args.q } })
  const res = await payload.find({
    collection: 'skills' as any,
    where: { and },
    depth: 1,
    limit,
    page,
    sort: args.sort || '-skillRank',
    overrideAccess: true,
  })
  return {
    configured: false,
    totalDocs: res.totalDocs,
    page: res.page,
    totalPages: res.totalPages,
    limit,
    entries: (res.docs as any[]).map((skill) => ({
      skill,
      reason: skill?.essentialReason || null,
      starterExample: undefined,
      order: 0,
    })),
  }
}

export function starterPackMetaBySkillId(entries: EssentialStarterPackEntry[]) {
  return new Map(entries.map((entry) => [String(entry.skill.id), entry] as const))
}
