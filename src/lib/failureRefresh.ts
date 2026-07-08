import type { Payload } from 'payload'
import { aggregateFailureKnowledge } from './failureKnowledge'
import { buildFailureCaseData, upsertFailureCase } from './failureCase'

export async function refreshFailureCasesForSkill(payload: Payload, skillId: string, limit = 1000) {
  const res = await payload.find({
    collection: 'compat-reports' as any,
    where: { skill: { equals: skillId } },
    depth: 1,
    limit,
    sort: '-createdAt',
    overrideAccess: true,
  })
  const groups = aggregateFailureKnowledge(res.docs as any[], 100)
  let processed = 0
  for (const group of groups) {
    await upsertFailureCase(payload, buildFailureCaseData(group))
    processed++
  }
  return { processed }
}
