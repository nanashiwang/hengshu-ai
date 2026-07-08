import Link from 'next/link'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'
import { SkillStatusTags } from '@/components/Tag'
import { Pagination } from '@/components/Pagination'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 30

function contractLabel(status?: string | null) {
  if (status === 'breaking_change') return '破坏性变更'
  if (status === 'compatible_change') return '兼容变更'
  if (status === 'initial') return '初始 Contract'
  return '待生成 Contract'
}

function passportLabel(passport?: any) {
  if (!passport) return 'Passport 待生成'
  const score = typeof passport.trustScore === 'number' ? Math.round(passport.trustScore) : null
  const status = passport.status === 'draft' ? '草稿' : passport.status === 'stale' ? '待刷新' : '当前'
  return score == null ? `Passport ${status}` : `Passport ${score} · ${status}`
}

function trustedCompatibleRunCount(passport?: any) {
  const value =
    passport?.reliabilitySummary?.trustedCompatibleRunCount ??
    passport?.evidenceSummary?.trustedCompatibleRunCount ??
    0
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
}

// 创作者工作台·我的作品（列出当前用户发布的所有 Skill，含 pending/rejected 状态与指标）
export default async function MySkillsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1)
  const user = await getCurrentUser()
  const payload = await getPayloadClient()
  const res = user
    ? await payload.find({
        collection: 'skills',
        where: { author: { equals: user.id } },
        sort: '-createdAt',
        limit: PAGE_SIZE,
        page,
        overrideAccess: true,
      })
    : { docs: [] as any[], totalPages: 1 }
  const skills = res.docs as any[]
  const evidenceEntries = await Promise.all(
    skills.map(async (skill) => {
      const versionId =
        typeof skill.currentVersion === 'object'
          ? skill.currentVersion?.id
          : skill.currentVersion
      const [passportRes, versionRes] = await Promise.all([
        payload.find({
          collection: 'skill-passports' as any,
          where: { skill: { equals: skill.id } },
          sort: '-lastVerifiedAt',
          limit: 1,
          depth: 0,
          overrideAccess: true,
        }),
        versionId
          ? payload
              .findByID({
                collection: 'skill-versions',
                id: String(versionId),
                depth: 0,
                overrideAccess: true,
              })
              .catch(() => null)
          : payload
              .find({
                collection: 'skill-versions',
                where: { skill: { equals: skill.id } },
                sort: '-createdAt',
                limit: 1,
                depth: 0,
                overrideAccess: true,
              })
              .then((r) => r.docs[0] || null),
      ])
      return [skill.id, { passport: passportRes.docs[0] || null, version: versionRes }] as const
    }),
  )
  const evidenceBySkillId = new Map(evidenceEntries)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">我的作品</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            这里不是单纯作品列表，而是创作者维护 Contract、Passport、证书预览和失败适配的工作台。
          </p>
        </div>
        <Link href="/console/skills/new" className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white">
          + 发布 Skill
        </Link>
      </div>
      {skills.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          还没有作品。
          <Link href="/console/skills/new" className="text-[var(--accent)]">
            发布第一个 Skill
          </Link>
          ，或从改一个现成的开始。
        </p>
      ) : (
        <ul className="space-y-2">
          {skills.map((s) => {
            const evidence = evidenceBySkillId.get(s.id)
            const passport = evidence?.passport
            const version = evidence?.version
            const trustedRuns = trustedCompatibleRunCount(passport)
            return (
              <li
                key={s.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link href={`/skills/${s.slug}`} className="font-medium hover:text-[var(--accent)]">
                      {s.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                      <SkillStatusTags skill={s} />
                      <span>· {trustedRuns} 次可信兼容</span>
                      {s.localScore ? <span>· 兼容分 {s.localScore}</span> : null}
                      <span>· {contractLabel(version?.contractStatus)}</span>
                      <span>· {passportLabel(passport)}</span>
                    </div>
                  </div>
                  <Link href={`/skills/${s.slug}`} className="shrink-0 text-xs text-[var(--accent)]">
                    查看/预览
                  </Link>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  <Link href={`/v1/skills/${s.slug}/contract`} className="text-[var(--accent)]">
                    Contract
                  </Link>
                  <Link href={`/v1/skills/${s.slug}/passport`} className="text-[var(--accent)]">
                    Passport
                  </Link>
                  <Link href={`/verify?certificateUrl=${encodeURIComponent(`/v1/skills/${encodeURIComponent(String(s.slug))}/certificate`)}`} className="text-[var(--accent)]">
                    证书/预览
                  </Link>
                  <Link href={`/failures?skillId=${encodeURIComponent(String(s.id))}`} className="text-[var(--accent)]">
                    失败库 / Adapter
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <Pagination page={page} totalPages={res.totalPages || 1} basePath="/console/skills" params={sp} />
    </div>
  )
}
