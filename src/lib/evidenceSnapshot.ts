import { createHash } from 'crypto'
import type { Payload } from 'payload'
import { canonicalString } from './canonical'
import { resolveRuntimeEnv } from './deploymentSettings'
import { publicSanitize } from './publicSanitize'
import { getSigningKeyId, signCanonical } from './signing'

export type EvidenceTargetType = 'skill_passport' | 'failure_case' | 'adapter_profile'

export function evidenceSnapshotCore(args: {
  targetType: EvidenceTargetType
  targetId: string
  evidenceHash: string
  signedAt: string
  targetSummary?: Record<string, unknown> | null
}) {
  const core: {
    targetType: EvidenceTargetType
    targetId: string
    evidenceHash: string
    signedAt: string
    targetSummary?: Record<string, unknown>
  } = {
    targetType: args.targetType,
    targetId: args.targetId,
    evidenceHash: args.evidenceHash,
    signedAt: args.signedAt,
  }
  if (args.targetSummary && typeof args.targetSummary === 'object') {
    core.targetSummary = publicSanitize(args.targetSummary)
  }
  return core
}

export async function writeEvidenceSnapshot(
  payload: Payload,
  args: { targetType: EvidenceTargetType; targetId: string; evidenceHash?: string | null; targetSummary?: Record<string, unknown> | null },
) {
  if (!args.evidenceHash) return null
  const signedAt = new Date().toISOString()
  const core = evidenceSnapshotCore({ ...args, evidenceHash: args.evidenceHash, signedAt })
  const payloadHash = createHash('sha256').update(canonicalString(core)).digest('hex')
  const runtimeEnv = await resolveRuntimeEnv(payload)
  const signature = signCanonical(core, runtimeEnv)
  const keyId = getSigningKeyId(runtimeEnv)
  const data: Record<string, unknown> = {
    targetType: args.targetType,
    targetId: args.targetId,
    evidenceHash: args.evidenceHash,
    payloadHash,
    keyId: keyId || undefined,
    signature: signature || undefined,
    signedAt,
  }
  if (core.targetSummary) data.targetSummary = core.targetSummary
  return payload.create({
    collection: 'evidence-snapshots' as any,
    overrideAccess: true,
    data,
  })
}
