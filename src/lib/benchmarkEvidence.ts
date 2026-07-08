import { evidenceHash } from './evidenceHash'

export type BenchmarkEvidenceReport = {
  modelName?: string
  benchmarkScore?: number
  benchmarkPassed?: boolean
  benchmarkCase?: string | { id?: string; title?: string }
  createdAt?: string
}

export type BenchmarkEvidenceSummary = {
  total: number
  passed: number
  averageScore: number
  cases: Array<{ caseId: string; title: string; total: number; passed: number; averageScore: number; models: string[]; lastRunAt?: string }>
  evidenceHash: string
}

function caseIdOf(value: BenchmarkEvidenceReport['benchmarkCase']) {
  if (!value) return 'unknown'
  return typeof value === 'object' ? String(value.id || 'unknown') : String(value)
}

function caseTitleOf(value: BenchmarkEvidenceReport['benchmarkCase'], fallback: string) {
  if (value && typeof value === 'object' && value.title) return String(value.title)
  return fallback
}

export function summarizeBenchmarkEvidence(reports: BenchmarkEvidenceReport[]): BenchmarkEvidenceSummary {
  const scored = reports.filter((report) => Number.isFinite(Number(report.benchmarkScore)))
  const groups = new Map<string, { title: string; scores: number[]; passed: number; models: Set<string>; lastRunAt?: string }>()
  for (const report of scored) {
    const caseId = caseIdOf(report.benchmarkCase)
    const current = groups.get(caseId) || { title: caseTitleOf(report.benchmarkCase, caseId === 'unknown' ? '未关联样例' : caseId), scores: [], passed: 0, models: new Set<string>() }
    current.title = caseTitleOf(report.benchmarkCase, current.title)
    const score = Math.max(0, Math.min(1, Number(report.benchmarkScore)))
    current.scores.push(score)
    if (report.benchmarkPassed) current.passed += 1
    if (report.modelName) current.models.add(String(report.modelName))
    if (report.createdAt && (!current.lastRunAt || report.createdAt > current.lastRunAt)) current.lastRunAt = report.createdAt
    groups.set(caseId, current)
  }
  const total = scored.length
  const passed = scored.filter((report) => report.benchmarkPassed).length
  const averageScore = total ? Math.round((scored.reduce((sum, report) => sum + Math.max(0, Math.min(1, Number(report.benchmarkScore))), 0) / total) * 1000) / 1000 : 0
  const cases = [...groups.entries()].map(([caseId, group]) => ({
    caseId,
    title: group.title,
    total: group.scores.length,
    passed: group.passed,
    averageScore: group.scores.length ? Math.round((group.scores.reduce((sum, score) => sum + score, 0) / group.scores.length) * 1000) / 1000 : 0,
    models: [...group.models].sort(),
    lastRunAt: group.lastRunAt,
  })).sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
  const core = { total, passed, averageScore, cases }
  return { ...core, evidenceHash: evidenceHash(core) }
}

export async function getSkillBenchmarkEvidence(payload: any, skillId: string, limit = 200): Promise<BenchmarkEvidenceSummary> {
  const res = await payload.find({
    collection: 'compat-reports' as any,
    where: {
      and: [
        { skill: { equals: skillId } },
        { source: { equals: 'benchmark' } },
        { benchmarkScore: { exists: true } },
      ],
    },
    limit,
    depth: 1,
    sort: '-createdAt',
    overrideAccess: true,
  }).catch(() => ({ docs: [] as BenchmarkEvidenceReport[] }))
  return summarizeBenchmarkEvidence(res.docs as BenchmarkEvidenceReport[])
}
