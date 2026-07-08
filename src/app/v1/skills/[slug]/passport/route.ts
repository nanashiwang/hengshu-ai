import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { resolveRuntimeEnv } from '@/lib/deploymentSettings'
import { getPublicKeyInfo } from '@/lib/signing'
import { verifyEvidenceSnapshot } from '@/lib/evidenceSnapshotVerify'
import { getSkillBenchmarkEvidence } from '@/lib/benchmarkEvidence'
import { publicSkillPassport } from '@/lib/passportPublic'
import { canReadSkillEvidence, skillPassportEvidenceWhere } from '@/lib/skillEvidenceAccess'

// GET /v1/skills/{slug}/passport —— 公开/作者预览 Skill Passport + 最新证据快照验签摘要。
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

  const passportRes = await payload.find({
    collection: 'skill-passports' as any,
    where: skillPassportEvidenceWhere(skill, user) as any,
    limit: 1,
    depth: 0,
    sort: '-lastVerifiedAt',
    overrideAccess: true,
  })
  const passport = passportRes.docs[0] as any
  if (!passport) return Response.json({ error: 'Passport 尚未生成' }, { status: 404 })

  const [snapshotRes, runtimeEnv, benchmarkEvidence] = await Promise.all([
    payload.find({
      collection: 'evidence-snapshots' as any,
      where: { and: [{ targetType: { equals: 'skill_passport' } }, { targetId: { equals: String(passport.id) } }] },
      limit: 1,
      depth: 0,
      sort: '-createdAt',
      overrideAccess: true,
    }),
    resolveRuntimeEnv(payload),
    getSkillBenchmarkEvidence(payload, String(skill.id)),
  ])
  const snapshot = (snapshotRes.docs as any[])[0] || null
  const publicKey = getPublicKeyInfo(runtimeEnv)
  const verify = snapshot ? verifyEvidenceSnapshot(snapshot, publicKey) : null

  return Response.json({
    skill: { id: skill.id, slug: skill.slug, title: skill.title },
    passport: publicSkillPassport(passport, benchmarkEvidence),
    evidenceSnapshot: snapshot
      ? {
          id: snapshot.id,
          evidenceHash: snapshot.evidenceHash,
          payloadHash: snapshot.payloadHash,
          keyId: snapshot.keyId,
          signedAt: snapshot.signedAt,
          verify,
        }
      : null,
    publicKey: publicKey ? { keyId: publicKey.keyId, algorithm: publicKey.algorithm } : null,
  })
}
