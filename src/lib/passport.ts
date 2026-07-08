import type { Payload } from 'payload'
import type { ModelCompat } from './compat'
import { evidenceHash } from './evidenceHash'
import { writeEvidenceSnapshot } from './evidenceSnapshot'

type SkillClass = 'verified' | 'imported' | 'high_risk' | 'rejected'
type PassportStatus = 'draft' | 'current' | 'stale' | 'revoked'

export interface BuildPassportArgs {
  skill: any
  version?: any
  artifact?: any
  compat?: ModelCompat[]
  trustedCompatibleRunCount?: number
  now?: Date
}

function refId(value: any): string | undefined {
  if (!value) return undefined
  return typeof value === 'object' ? String(value.id || '') || undefined : String(value)
}

function hasSignature(artifact?: any): boolean {
  if (artifact?.signature) return true
  const manifest = String(artifact?.manifest || '')
  return /(^|[\s{,\"])signature[\"']?\s*:/.test(manifest)
}

function riskPermissions(version?: any): string[] {
  const p = version?.permissions || {}
  return ['network', 'fileRead', 'fileWrite', 'shell'].filter((k) => p[k] === true)
}

function classifySkill(args: BuildPassportArgs): SkillClass {
  if (args.skill?.status === 'rejected') return 'rejected'
  if (riskPermissions(args.version).length > 0) return 'high_risk'
  if (hasSignature(args.artifact) && args.artifact?.checksum) return 'verified'
  return 'imported'
}

function statusForSkill(args: BuildPassportArgs): PassportStatus {
  if (args.skill?.status === 'archived' || args.skill?.status === 'rejected') return 'revoked'
  if (args.skill?.status !== 'published') return 'draft'
  const last = args.skill?.lastRunAt || args.skill?.lastUpdatedAt || args.skill?.updatedAt || args.skill?.createdAt
  if (!last) return 'current'
  const ageDays = (Number(args.now || new Date()) - Number(new Date(last))) / 86_400_000
  return ageDays > 180 ? 'stale' : 'current'
}

function trustScore(args: BuildPassportArgs, skillClass: SkillClass): number {
  const evidence = (args.compat || []).reduce((sum, m) => sum + (m.reports || 0), 0)
  const verified = (args.compat || []).reduce((sum, m) => sum + (m.verified || 0), 0)
  const signed = hasSignature(args.artifact) ? 20 : 0
  const manifest = args.artifact?.checksum ? 15 : 0
  const evidenceScore = Math.min(35, evidence * 3)
  const verifiedScore = Math.min(15, verified * 5)
  const safety = skillClass === 'high_risk' ? -20 : skillClass === 'rejected' ? -50 : 15
  return Math.max(0, Math.min(100, Math.round(signed + manifest + evidenceScore + verifiedScore + safety)))
}

export function buildSkillPassportData(args: BuildPassportArgs) {
  const skillClass = classifySkill(args)
  const compat = args.compat || []
  const evidenceCount = compat.reduce((sum, m) => sum + (m.reports || 0), 0)
  const verifiedCount = compat.reduce((sum, m) => sum + (m.verified || 0), 0)
  const risky = riskPermissions(args.version)
  const best = [...compat].sort((a, b) => (b.successRate || 0) - (a.successRate || 0))[0]
  const lastVerifiedAt = args.now || new Date()

  const evidenceSummary = {
    evidenceCount,
    verifiedCount,
    trustedCompatibleRunCount: args.trustedCompatibleRunCount || 0,
    source: 'Skills/SkillVersions/SkillArtifacts/CompatReports',
  }

  return {
    title: `${args.skill?.title || 'Untitled'} Passport`,
    skill: refId(args.skill),
    skillVersion: refId(args.version),
    status: statusForSkill(args),
    skillClass,
    trustScore: trustScore(args, skillClass),
    signatureStatus: hasSignature(args.artifact) ? 'signed' : args.artifact?.checksum ? 'checksum_only' : 'missing',
    manifestChecksum: args.artifact?.checksum || undefined,
    capabilitySummary: {
      inputSchema: args.version?.inputSchema || null,
      outputSchema: args.version?.outputSchema || null,
      recommendedModels: args.version?.recommendedModels || null,
      examples: Array.isArray(args.version?.examples) ? args.version.examples.length : 0,
    },
    compatibilitySummary: {
      models: compat.map((m) => ({
        modelName: m.modelName,
        modelProfile: m.modelProfile || null,
        modelVersion: m.modelVersion || null,
        reports: m.reports,
        verified: m.verified,
        effectiveSamples: m.effectiveSamples ?? null,
        sourceSummary: m.sourceSummary || [],
        successRate: m.successRate,
        formatRate: m.formatRate,
        avgLatencyMs: m.avgLatencyMs,
        lowSample: m.lowSample,
      })),
      bestModel: best ? { modelName: best.modelName, modelVersion: best.modelVersion || null } : null,
    },
    reliabilitySummary: {
      successRate: args.skill?.successRate ?? null,
      formatSuccessRate: args.skill?.formatSuccessRate ?? null,
      trustedCompatibleRunCount: args.trustedCompatibleRunCount || 0,
      avgLatencyMs: args.skill?.avgLatencyMs ?? null,
      avgCost: args.skill?.avgCost ?? null,
    },
    safetySummary: {
      permissions: args.version?.permissions || null,
      riskyPermissions: risky,
      requiresHumanReview: risky.length > 0 || skillClass !== 'verified',
    },
    failureSummary: {
      knownFailureTypes: compat.length ? 'from_compat_reports' : 'none_yet',
    },
    evidenceSummary,
    evidenceHash: evidenceHash({
      skill: refId(args.skill),
      skillVersion: refId(args.version),
      signatureStatus: hasSignature(args.artifact) ? 'signed' : args.artifact?.checksum ? 'checksum_only' : 'missing',
      manifestChecksum: args.artifact?.checksum || null,
      compatibility: compat.map((m) => [
        m.modelName,
        m.modelProfile || null,
        m.modelVersion || null,
        m.reports,
        m.verified,
        m.effectiveSamples ?? null,
        m.sourceSummary || [],
        m.successRate,
        m.formatRate,
        m.avgLatencyMs,
        m.lowSample,
      ]),
      trustedCompatibleRunCount: args.trustedCompatibleRunCount || 0,
      evidenceSummary,
    }),
    enterpriseSummary: {
      visibility: args.skill?.visibility || 'public',
      registryStatus: args.skill?.visibility === 'enterprise' ? 'needs_registry_approval' : 'not_in_registry',
    },
    lastVerifiedAt: lastVerifiedAt.toISOString(),
  }
}

export async function upsertSkillPassport(payload: Payload, data: ReturnType<typeof buildSkillPassportData>) {
  const existing = await payload.find({
    collection: 'skill-passports' as any,
    where: { skill: { equals: data.skill } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = existing.docs[0] as any
  let saved: any
  if (doc?.id) {
    saved = await payload.update({
      collection: 'skill-passports' as any,
      id: doc.id,
      data,
      overrideAccess: true,
    })
  } else {
    saved = await payload.create({
      collection: 'skill-passports' as any,
      data,
      overrideAccess: true,
    })
  }
  try {
    await writeEvidenceSnapshot(payload, {
      targetType: 'skill_passport',
      targetId: String(saved.id),
      evidenceHash: data.evidenceHash,
      targetSummary: {
        skill: data.skill,
        skillVersion: data.skillVersion,
        skillClass: data.skillClass,
        trustScore: data.trustScore,
        compatibility: {
          bestModel: data.compatibilitySummary?.bestModel || null,
          models: Array.isArray(data.compatibilitySummary?.models)
            ? data.compatibilitySummary.models.map((m: any) => ({
                modelName: m.modelName,
                modelVersion: m.modelVersion || null,
                modelProfile: m.modelProfile || null,
                effectiveSamples: m.effectiveSamples ?? null,
              }))
            : [],
        },
      },
    })
  } catch (e) {
    payload.logger?.error(`writeEvidenceSnapshot(skill_passport) 失败: ${(e as Error).message}`)
  }
  return saved
}
