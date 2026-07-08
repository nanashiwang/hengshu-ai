import type { Payload } from 'payload'
import type { FailureKnowledgeGroup } from './failureKnowledge'
import { evidenceHash } from './evidenceHash'
import { writeEvidenceSnapshot } from './evidenceSnapshot'

export function buildFailureCaseData(group: FailureKnowledgeGroup, now = new Date()) {
  const sample = group.sampleSkills[0]
  const coreEvidence = {
    profileKey: group.profileKey,
    errorType: String(group.errorType),
    modelName: group.modelName,
    primaryModelVersion: group.primaryModelVersion,
    primaryInputBucket: group.primaryInputBucket,
    count: group.count,
    skillCount: group.skillCount,
    inputBuckets: group.inputBuckets,
    outputBuckets: group.outputBuckets,
    modelBreakdown: group.modelBreakdown,
    modelVersions: group.modelVersions,
    modelVersionBreakdown: group.modelVersionBreakdown,
    sourceBreakdown: group.sourceBreakdown,
    sampleSkillIds: group.sampleSkills.map((s) => s.id),
  }
  return {
    title: `${group.meta.label} · ${sample?.title || group.primaryInputBucket} · ${group.modelName}`,
    profileKey: group.profileKey,
    errorType: String(group.errorType),
    modelName: group.modelName,
    primaryModelVersion: group.primaryModelVersion,
    skill: sample?.id,
    symptom: group.meta.symptom,
    likelyCause: group.meta.likelyCause,
    repairTemplate: group.meta.repairTemplate,
    verifyTemplate: group.meta.verifyTemplate,
    primaryInputBucket: group.primaryInputBucket,
    inputBuckets: group.inputBuckets,
    outputBuckets: group.outputBuckets,
    modelBreakdown: group.modelBreakdown,
    modelVersions: group.modelVersions,
    modelVersionBreakdown: group.modelVersionBreakdown,
    sourceBreakdown: group.sourceBreakdown,
    evidenceHash: evidenceHash(coreEvidence),
    occurrenceCount: group.count,
    affectedSkillCount: group.skillCount,
    status: group.count >= 3 ? 'confirmed' : 'observed',
    lastObservedAt: now.toISOString(),
  }
}

export async function upsertFailureCase(payload: Payload, data: ReturnType<typeof buildFailureCaseData>) {
  const existing = await payload.find({
    collection: 'failure-cases' as any,
    where: data.profileKey
      ? { profileKey: { equals: data.profileKey } }
      : { and: [{ errorType: { equals: data.errorType } }, { modelName: { equals: data.modelName } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = existing.docs[0] as any
  let saved: any
  if (doc?.id) {
    saved = await payload.update({
      collection: 'failure-cases' as any,
      id: doc.id,
      data,
      overrideAccess: true,
    })
  } else {
    saved = await payload.create({
      collection: 'failure-cases' as any,
      data,
      overrideAccess: true,
    })
  }
  try {
    await writeEvidenceSnapshot(payload, {
      targetType: 'failure_case',
      targetId: String(saved.id),
      evidenceHash: data.evidenceHash,
      targetSummary: {
        profileKey: data.profileKey,
        errorType: data.errorType,
        modelName: data.modelName,
        primaryModelVersion: data.primaryModelVersion,
        modelVersions: data.modelVersions,
        skill: data.skill,
        occurrenceCount: data.occurrenceCount,
      },
    })
  } catch (e) {
    payload.logger?.error(`writeEvidenceSnapshot(failure_case) 失败: ${(e as Error).message}`)
  }
  return saved
}
