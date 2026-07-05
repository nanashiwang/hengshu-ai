import type { Payload } from 'payload'
import { anonHash } from './compat'

export interface RunnerSuppressionRef {
  id: string
  runnerId?: string | null
}

export function compatSuppressionWheresForUser(userId: string, runners: RunnerSuppressionRef[] = []): any[] {
  const wheres: any[] = [
    { and: [{ anonymousUserHash: { equals: anonHash(String(userId)) } }, { source: { equals: 'online' } }] },
  ]
  for (const runner of runners) {
    if (runner.id) wheres.push({ runner: { equals: runner.id } })
    if (runner.runnerId) wheres.push({ anonymousUserHash: { equals: anonHash(String(runner.runnerId)) } })
  }
  return wheres
}

async function listRunnerRefsForUser(payload: Payload, userId: string): Promise<RunnerSuppressionRef[]> {
  const refs: RunnerSuppressionRef[] = []
  let page = 1
  for (;;) {
    const res = await payload.find({
      collection: 'runner-clients',
      where: { user: { equals: userId } },
      limit: 500,
      page,
      depth: 0,
      overrideAccess: true,
      sort: 'id',
    })
    for (const doc of res.docs as any[]) refs.push({ id: String(doc.id), runnerId: doc.runnerId || null })
    if (!res.hasNextPage) break
    page++
  }
  return refs
}

// 封禁后追溯降权：online 报告按 user anonHash；Runner 具名/匿名报告按 runner relation/runnerId anonHash。
export async function suppressUserCompatReports(payload: Payload, userId: string): Promise<number> {
  const runners = await listRunnerRefsForUser(payload, userId)
  const wheres = compatSuppressionWheresForUser(userId, runners)
  let touched = 0
  for (const where of wheres) {
    const res = await payload.update({
      collection: 'compat-reports',
      where,
      data: { suppressed: true },
      overrideAccess: true,
    } as any)
    touched += Number((res as any)?.docs?.length || (res as any)?.totalDocs || 0)
  }
  return touched
}
