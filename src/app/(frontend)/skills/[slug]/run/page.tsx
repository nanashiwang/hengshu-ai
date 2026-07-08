import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'
import { RunStudio } from '@/components/RunStudio'
import { approvedPlatformModels } from '@/lib/constants'
import { resolveRuntimeEnv } from '@/lib/deploymentSettings'
import { canAccessEnterpriseSkill } from '@/lib/enterprise'
import { canUsePublishedSkillDirectly } from '@/lib/skillEvidenceAccess'
import { resolveCurrentSkillVersionForPublicEvidence } from '@/lib/skillVersionPublic'

export const dynamic = 'force-dynamic'

export default async function RunPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { slug } = await params
  const sp = await searchParams
  const organizationId = typeof sp.organizationId === 'string' ? sp.organizationId.trim() : undefined
  const payload = await getPayloadClient()
  const user = await getCurrentUser()
  const res = await payload.find({
    collection: 'skills',
    where: { slug: { equals: slug } },
    depth: 2,
    limit: 1,
    overrideAccess: true,
  })
  const skill = res.docs[0]
  if (!skill || skill.status !== 'published') notFound()

  const version = await resolveCurrentSkillVersionForPublicEvidence(payload as any, skill)
  if (!version) notFound()
  const models = ((version?.recommendedModels as any)?.cloud || []) as string[]
  const fullUser = user
    ? await payload
        .findByID({
          collection: 'users',
          id: user.id,
          depth: 0,
          overrideAccess: true,
        })
        .catch(() => null)
    : null
  if (skill.visibility === 'enterprise') {
    if (!user || !organizationId) notFound()
    const ent = await canAccessEnterpriseSkill(payload, {
      userId: String(user.id),
      organizationId,
      skillId: String(skill.id),
    })
    if (!ent.ok) notFound()
  } else if (!canUsePublishedSkillDirectly(skill, user)) {
    notFound()
  }

  const inputSchema = (version?.inputSchema || {}) as Record<string, any>
  const runtimeEnv = await resolveRuntimeEnv(payload)
  const platformModels = [...approvedPlatformModels(runtimeEnv)]
  const passportRes = await payload.find({
    collection: 'skill-passports' as any,
    where: {
      and: [{ skill: { equals: skill.id } }, { status: { equals: 'current' } }],
    },
    sort: '-lastVerifiedAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const passport = passportRes.docs[0] as any
  const trustScore = passport
    ? Math.round(Number(passport.trustScore || 0))
    : null
  const evidenceHref = passport?.id
    ? `/verify?targetType=skill_passport&targetId=${encodeURIComponent(String(passport.id))}`
    : null

  return (
    <div className="space-y-4">
      <Link
        href={`/skills/${slug}`}
        className="text-sm text-[var(--muted)] hover:text-[var(--text)]"
      >
        ← 返回详情
      </Link>
      <div>
        <h1 className="text-xl font-semibold">运行：{skill.title}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{skill.description}</p>
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 text-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-medium text-[var(--text)]">
              试跑前先确认可信证据
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              本次运行会写入你的私人台账，并继续回流兼容证据；建议先看
              Passport、Contract 与达标证书。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-[var(--border)] px-3 py-1 text-[var(--muted)]">
              Passport {trustScore == null ? '待生成' : trustScore}
            </span>
            <a
              href={`/v1/skills/${skill.slug}/passport`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[var(--border)] px-3 py-1 text-[var(--accent)] hover:border-[var(--accent)]"
            >
              Passport
            </a>
            <a
              href={`/v1/skills/${skill.slug}/contract`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[var(--border)] px-3 py-1 text-[var(--accent)] hover:border-[var(--accent)]"
            >
              Contract
            </a>
            <a
              href={`/verify?certificateUrl=${encodeURIComponent(`/v1/skills/${encodeURIComponent(String(skill.slug))}/certificate`)}`}
              className="rounded-full border border-[var(--border)] px-3 py-1 text-[var(--accent)] hover:border-[var(--accent)]"
            >
              达标证书
            </a>
            {evidenceHref ? (
              <a
                href={evidenceHref}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-[var(--accent)] hover:border-[var(--accent)]"
              >
                证据验签
              </a>
            ) : null}
          </div>
        </div>
      </div>
      <RunStudio
        slug={skill.slug as string}
        skillId={String(skill.id)}
        organizationId={organizationId}
        inputSchema={inputSchema}
        loggedIn={!!user}
        models={models}
        platformModels={platformModels}
        hasByok={!!(fullUser as any)?.newapiKeyEncrypted}
      />
    </div>
  )
}
