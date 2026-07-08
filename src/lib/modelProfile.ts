import type { Payload } from 'payload'
import type { GlobalModelStat } from './compat'

export interface BuildModelProfileArgs {
  modelName: string
  modelVersion?: string
  stat?: GlobalModelStat
  price?: any
  now?: Date
}

function inferProvider(modelName: string): string {
  const m = modelName.toLowerCase()
  if (m.includes('qwen')) return 'Alibaba/Qwen'
  if (m.includes('deepseek')) return 'DeepSeek'
  if (m.includes('glm')) return 'Zhipu/GLM'
  if (m.includes('kimi') || m.includes('moonshot')) return 'Moonshot/Kimi'
  if (m.includes('gpt')) return 'OpenAI'
  if (m.includes('claude')) return 'Anthropic'
  return 'unknown'
}

function statusFromEvidence(stat?: GlobalModelStat): 'observed' | 'verified' | 'stale' | 'deprecated' {
  if (!stat || stat.samples <= 0) return 'observed'
  return stat.samples >= 10 ? 'verified' : 'observed'
}

function metricNumber(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function modelRegressionAlerts(previous: any, next: ReturnType<typeof buildModelProfileData>) {
  const prevIssues = previous?.knownIssues && typeof previous.knownIssues === 'object' ? previous.knownIssues : {}
  const nextIssues = next.knownIssues && typeof next.knownIssues === 'object' ? next.knownIssues : {}
  const alerts: Array<{ metric: string; from: number; to: number; delta: number; severity: 'warning' | 'critical' }> = []
  const checks = [
    { metric: 'successRate', threshold: 0.1, critical: 0.2 },
    { metric: 'formatRate', threshold: 0.1, critical: 0.2 },
  ]
  for (const c of checks) {
    const from = metricNumber((prevIssues as any)[c.metric])
    const to = metricNumber((nextIssues as any)[c.metric])
    if (from == null || to == null) continue
    const delta = Math.round((to - from) * 1000) / 1000
    if (delta <= -c.threshold) {
      alerts.push({
        metric: c.metric,
        from,
        to,
        delta,
        severity: Math.abs(delta) >= c.critical ? 'critical' : 'warning',
      })
    }
  }
  return alerts
}


function metricSnapshotFromProfile(profile: any, observedAt?: string) {
  const issues = profile?.knownIssues && typeof profile.knownIssues === 'object' ? profile.knownIssues : {}
  const capabilities = profile?.capabilities && typeof profile.capabilities === 'object' ? profile.capabilities : {}
  return {
    observedAt: observedAt || profile?.lastObservedAt || profile?.updatedAt || profile?.createdAt || new Date().toISOString(),
    successRate: metricNumber((issues as any).successRate),
    formatRate: metricNumber((issues as any).formatRate),
    avgLatencyMs: metricNumber((issues as any).avgLatencyMs),
    samples: metricNumber((capabilities as any).observedSamples) ?? 0,
    inputBucketSummary: Array.isArray((capabilities as any).inputBucketSummary)
      ? (capabilities as any).inputBucketSummary
      : [],
  }
}

export function buildDriftHistory(previous: any, next: ReturnType<typeof buildModelProfileData>, limit = 30) {
  const existing = Array.isArray(previous?.driftHistory) ? previous.driftHistory.filter(Boolean) : []
  const previousSnapshot = metricSnapshotFromProfile(previous)
  const nextSnapshot = metricSnapshotFromProfile(next, next.lastObservedAt)
  const rows = [...existing]
  const last = rows[rows.length - 1]
  if (!last || last.observedAt !== previousSnapshot.observedAt) rows.push(previousSnapshot)
  rows.push(nextSnapshot)
  return rows.slice(-limit)
}

export function buildModelProfileData(args: BuildModelProfileArgs) {
  const now = args.now || new Date()
  const stat = args.stat
  const jsonScore = stat ? Math.round((stat.formatRate || 0) * 100) : undefined
  return {
    provider: args.price?.provider || inferProvider(args.modelName),
    modelName: args.modelName,
    modelVersion: args.modelVersion || args.price?.modelVersion || stat?.modelVersion || undefined,
    profileStatus: statusFromEvidence(stat),
    supportsStructuredOutput: (jsonScore || 0) >= 80,
    supportsToolUse: false,
    jsonStabilityScore: jsonScore,
    inputPrice: args.price?.inputPrice,
    outputPrice: args.price?.outputPrice,
    region: args.price?.region,
    platformPayAllowed: false,
    knownIssues: {
      lowSamples: stat ? stat.samples < 10 : true,
      successRate: stat?.successRate ?? null,
      formatRate: stat?.formatRate ?? null,
      avgLatencyMs: stat?.avgLatencyMs ?? null,
    },
    capabilities: {
      inferredProvider: inferProvider(args.modelName),
      observedSamples: stat?.samples || 0,
      effectiveSamples: stat?.effectiveSamples ?? stat?.samples ?? 0,
      sourceSummary: stat?.sourceSummary || [],
      inputBucketSummary: stat?.inputBucketSummary || [],
    },
    freshness: {
      lastObservedAt: now.toISOString(),
      source: 'CompatReports/ModelPriceSnapshots',
    },
    regressionAlerts: [] as Array<{ metric: string; from: number; to: number; delta: number; severity: 'warning' | 'critical' }>,
    driftSummary: {
      comparedWithPrevious: false,
      status: 'new_or_uncompared',
    },
    driftHistory: [] as Array<{
      observedAt: string
      successRate: number | null
      formatRate: number | null
      avgLatencyMs: number | null
      samples: number | null
      inputBucketSummary?: GlobalModelStat['inputBucketSummary']
    }>,
    lastObservedAt: now.toISOString(),
  }
}

export async function upsertModelProfile(payload: Payload, data: ReturnType<typeof buildModelProfileData>) {
  const existing = await payload.find({
    collection: 'model-profiles' as any,
    where: data.modelVersion
      ? { and: [{ modelName: { equals: data.modelName } }, { modelVersion: { equals: data.modelVersion } }] }
      : { modelName: { equals: data.modelName } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = existing.docs[0] as any
  if (doc?.id) {
    const alerts = modelRegressionAlerts(doc, data)
    const nextData = {
      ...data,
      regressionAlerts: alerts,
      driftSummary: {
        comparedWithPrevious: true,
        status: alerts.length ? 'regression_detected' : 'stable',
        previousObservedAt: doc.lastObservedAt || doc.updatedAt || doc.createdAt || null,
        comparedAt: new Date().toISOString(),
      },
      driftHistory: buildDriftHistory(doc, data),
    }
    return payload.update({
      collection: 'model-profiles' as any,
      id: doc.id,
      data: nextData,
      overrideAccess: true,
    })
  }
  return payload.create({
    collection: 'model-profiles' as any,
    data,
    overrideAccess: true,
  })
}

export async function ensureModelProfile(
  payload: Payload,
  modelName: string,
  provider?: string,
  modelVersion?: string,
): Promise<string | undefined> {
  const name = String(modelName || '').trim()
  const version = String(modelVersion || '').trim()
  if (!name) return undefined
  const existing = await payload.find({
    collection: 'model-profiles' as any,
    where: version
      ? { and: [{ modelName: { equals: name } }, { modelVersion: { equals: version } }] }
      : { modelName: { equals: name } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = existing.docs[0] as any
  if (doc?.id) return String(doc.id)
  const created = await payload.create({
    collection: 'model-profiles' as any,
    data: {
      ...buildModelProfileData({ modelName: name }),
      provider: provider || inferProvider(name),
      modelVersion: version || undefined,
    },
    overrideAccess: true,
  })
  return String((created as any).id)
}
