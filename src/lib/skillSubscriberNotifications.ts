import type { Payload, PayloadRequest } from 'payload'
import { notify } from '@/lib/notify'

type Ref = string | number | { id?: string | number } | null | undefined
type SkillRefDoc = {
  id?: string
  title?: string
  slug?: string
  author?: Ref
  currentVersion?: Ref
  status?: string
}
type VersionRefDoc = {
  id?: string
  version?: string
}

function refId(ref: Ref): string | null {
  if (!ref) return null
  if (typeof ref === 'object') return ref.id == null ? null : String(ref.id)
  return String(ref)
}

export function shouldNotifySkillVersionUpdate(args: {
  operation: 'create' | 'update'
  doc: SkillRefDoc
  previousDoc?: SkillRefDoc | null
}): boolean {
  const { operation, doc, previousDoc } = args
  if (operation !== 'update') return false
  if (doc.status !== 'published' || previousDoc?.status !== 'published') return false
  const currentVersionId = refId(doc.currentVersion)
  const previousVersionId = refId(previousDoc.currentVersion)
  return Boolean(currentVersionId && previousVersionId && currentVersionId !== previousVersionId)
}

export function collectSkillSubscriberIds(args: {
  favorites?: Array<{ user?: Ref }>
  installs?: Array<{ user?: Ref; status?: string }>
  authorId?: Ref
  actorId?: Ref
}): string[] {
  const excluded = new Set([refId(args.authorId), refId(args.actorId)].filter(Boolean) as string[])
  const ids = new Set<string>()

  for (const fav of args.favorites || []) {
    const userId = refId(fav.user)
    if (userId && !excluded.has(userId)) ids.add(userId)
  }

  for (const install of args.installs || []) {
    if (install.status !== 'installed') continue
    const userId = refId(install.user)
    if (userId && !excluded.has(userId)) ids.add(userId)
  }

  return [...ids]
}

async function findAllByPages(
  payload: Payload,
  args: {
    collection: 'favorites' | 'skill-installs'
    where: Record<string, unknown>
    req?: Partial<PayloadRequest>
  },
): Promise<any[]> {
  const docs: any[] = []
  let page = 1
  let totalPages = 1
  do {
    const res = await payload.find({
      collection: args.collection,
      where: args.where,
      depth: 0,
      limit: 200,
      page,
      overrideAccess: true,
      ...(args.req ? { req: args.req } : {}),
    } as any)
    docs.push(...(res.docs as any[]))
    totalPages = res.totalPages || 1
    page += 1
  } while (page <= totalPages)
  return docs
}

export async function notifySkillSubscribers(
  payload: Payload,
  args: {
    skill: SkillRefDoc
    version?: VersionRefDoc | null
    actorId?: Ref
    req?: Partial<PayloadRequest>
  },
): Promise<{ notified: number }> {
  const skillId = refId(args.skill.id)
  if (!skillId) return { notified: 0 }

  const [favorites, installs] = await Promise.all([
    findAllByPages(payload, {
      collection: 'favorites',
      where: { skill: { equals: skillId } },
      req: args.req,
    }),
    findAllByPages(payload, {
      collection: 'skill-installs',
      where: { and: [{ skill: { equals: skillId } }, { status: { equals: 'installed' } }] },
      req: args.req,
    }),
  ])

  const subscriberIds = collectSkillSubscriberIds({
    favorites,
    installs,
    authorId: args.skill.author,
    actorId: args.actorId,
  })
  const versionLabel = args.version?.version ? ` v${args.version.version}` : ''
  const title = `你订阅的 Skill「${args.skill.title || 'Skill'}」有新版本`
  const link = args.skill.slug ? `/skills/${args.skill.slug}` : undefined

  await Promise.all(
    subscriberIds.map((userId) =>
      notify(payload, {
        userId,
        type: 'skill_updated',
        title,
        body: versionLabel ? `已更新到${versionLabel}，可前往查看或重新安装。` : '可前往查看或重新安装。',
        link,
        relatedSkill: skillId,
        actorId: refId(args.actorId) || undefined,
        req: args.req,
      }),
    ),
  )

  return { notified: subscriberIds.length }
}
