import type { Payload } from 'payload'
import { createHash } from 'crypto'
import { rankDataDrivenRoute } from './route'
import { canonicalString } from './canonical'
import { signCanonical, getSigningKeyId } from './signing'
import { resolveRuntimeEnv } from './deploymentSettings'
import { hmacDigest } from './secrets'

// 规模分档（避免回传精确长度）
export function bucketSize(n: number): string {
  const v = n || 0
  if (v < 100) return '0-100'
  if (v < 500) return '100-500'
  if (v < 2000) return '500-2k'
  if (v < 8000) return '2k-8k'
  return '8k+'
}

// 匿名标识：HMAC(runnerId + 服务端 salt)，不可逆向到 user
export function anonHash(runnerId: string): string {
  return hmacDigest(String(runnerId), 'anon', 32)
}

// ── 护城河第0层：活体数据聚合 ──
// 近期数据主导（模型月更、旧样本会腐坏）：按时间指数衰减加权；样本稀疏则诚实标注、不用误导性百分比霸榜。
const HALF_LIFE_DAYS = 30 // 半衰期：30 天前的报告权重减半
export const COMPAT_LOOKBACK_DAYS = 180 // 聚合只读近 180 天，防旧数据腐坏/全量同步重算拖垮热路径
const MIN_MODEL_SAMPLE = 5 // 单模型报告数 < 此值 → lowSample（前端显示"战绩积累中"而非百分比）
const CONF_FULL_N = 10 // 兼容分置信满额所需的有效(衰减)样本量；不足则按置信度衰减分数

export function compatLookbackStartISO(now = new Date()): string {
  const d = new Date(now)
  d.setDate(d.getDate() - COMPAT_LOOKBACK_DAYS)
  return d.toISOString()
}

function decayWeight(createdAt: unknown, nowMs: number): number {
  const t = createdAt ? new Date(createdAt as string).getTime() : NaN
  // 缺失/非法时间戳按 0 权重（不计入），避免"无时间"被当作"最新报告"霸榜/被利用
  if (!Number.isFinite(t)) return 0
  const ageDays = Math.max(0, (nowMs - t) / 86_400_000)
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS)
}

// 来源分级权重：verified/benchmark(系统评测) 最可信、community 次之、online(在线试用) 最低——削弱在线通道刷分/投毒杠杆
export const COMPAT_SOURCE_WEIGHT: Record<string, number> = { verified: 1, benchmark: 1, community: 0.5, online: 0.3 }
function sourceWeight(source: unknown): number {
  return COMPAT_SOURCE_WEIGHT[String(source)] ?? 0.5
}

export type CompatSourceSummary = { source: string; count: number; weight: number }
export type CompatInputBucketSummary = {
  inputBucket: string
  count: number
  effectiveSamples: number
  successRate: number
  formatRate: number
}
export type CompatTaskProfileSummary = {
  profileKey: string
  inputBucket: string
  errorType: string
  modelVersion?: string | null
  count: number
  effectiveSamples: number
  successRate: number
  formatRate: number
}
export type CompatSkillProfileSummary = {
  profileKey: string
  skillId: string
  skillSlug?: string | null
  skillTitle?: string | null
  inputBucket: string
  errorType: string
  modelVersion?: string | null
  count: number
  effectiveSamples: number
  successRate: number
  formatRate: number
}

function summarizeSources(reports: any[]): CompatSourceSummary[] {
  const bySource = new Map<string, { count: number; weight: number }>()
  for (const r of reports) {
    const source = String(r.source || 'community')
    const current = bySource.get(source) || { count: 0, weight: sourceWeight(source) }
    current.count++
    bySource.set(source, current)
  }
  return Array.from(bySource.entries())
    .map(([source, row]) => ({ source, count: row.count, weight: row.weight }))
    .sort((a, b) => b.weight - a.weight || b.count - a.count || a.source.localeCompare(b.source))
}

function summarizeInputBuckets(reports: any[], nowMs: number): CompatInputBucketSummary[] {
  const byBucket = new Map<string, { count: number; wSum: number; wSuccess: number; wFormat: number }>()
  for (const r of reports) {
    const inputBucket = String(r.inputSizeBucket || '').trim()
    if (!inputBucket) continue
    const current = byBucket.get(inputBucket) || { count: 0, wSum: 0, wSuccess: 0, wFormat: 0 }
    const w = r.suppressed ? 0 : decayWeight(r.createdAt, nowMs) * sourceWeight(r.source)
    current.count++
    current.wSum += w
    if (r.success) current.wSuccess += w
    if (r.formatValid) current.wFormat += w
    byBucket.set(inputBucket, current)
  }
  return Array.from(byBucket.entries())
    .map(([inputBucket, row]) => ({
      inputBucket,
      count: row.count,
      effectiveSamples: Math.round(row.wSum * 10) / 10,
      successRate: row.wSum > 0 ? row.wSuccess / row.wSum : 0,
      formatRate: row.wSum > 0 ? row.wFormat / row.wSum : 0,
    }))
    .sort((a, b) => b.effectiveSamples - a.effectiveSamples || b.count - a.count || a.inputBucket.localeCompare(b.inputBucket))
}

function reportModelVersion(report: any): string {
  const profile = report?.modelProfile && typeof report.modelProfile === 'object' ? report.modelProfile : null
  return String(profile?.modelVersion || report?.modelVersion || 'unversioned').trim() || 'unversioned'
}

function summarizeTaskProfiles(reports: any[], nowMs: number, limit = 8): CompatTaskProfileSummary[] {
  const byProfile = new Map<string, { inputBucket: string; errorType: string; modelVersion: string; count: number; wSum: number; wSuccess: number; wFormat: number }>()
  for (const r of reports) {
    const inputBucket = String(r.inputSizeBucket || 'unknown').trim() || 'unknown'
    const errorType = r.success ? 'success' : String(r.errorType || 'unknown_error').trim() || 'unknown_error'
    const modelVersion = reportModelVersion(r)
    const profileKey = `${inputBucket}|${errorType}|${modelVersion}`
    const current = byProfile.get(profileKey) || { inputBucket, errorType, modelVersion, count: 0, wSum: 0, wSuccess: 0, wFormat: 0 }
    const w = r.suppressed ? 0 : decayWeight(r.createdAt, nowMs) * sourceWeight(r.source)
    current.count++
    current.wSum += w
    if (r.success) current.wSuccess += w
    if (r.formatValid) current.wFormat += w
    byProfile.set(profileKey, current)
  }
  return Array.from(byProfile.entries())
    .map(([profileKey, row]) => ({
      profileKey,
      inputBucket: row.inputBucket,
      errorType: row.errorType,
      modelVersion: row.modelVersion === 'unversioned' ? null : row.modelVersion,
      count: row.count,
      effectiveSamples: Math.round(row.wSum * 10) / 10,
      successRate: row.wSum > 0 ? row.wSuccess / row.wSum : 0,
      formatRate: row.wSum > 0 ? row.wFormat / row.wSum : 0,
    }))
    .sort((a, b) => b.effectiveSamples - a.effectiveSamples || b.count - a.count || a.profileKey.localeCompare(b.profileKey))
    .slice(0, limit)
}

function skillSummary(value: any): { id: string; slug?: string | null; title?: string | null } | null {
  if (!value) return null
  if (typeof value === 'object') {
    const id = value.id ? String(value.id) : ''
    return id ? { id, slug: value.slug || null, title: value.title || value.name || null } : null
  }
  return { id: String(value) }
}

function summarizeSkillProfiles(reports: any[], nowMs: number, limit = 8): CompatSkillProfileSummary[] {
  const byProfile = new Map<string, { skillId: string; skillSlug?: string | null; skillTitle?: string | null; inputBucket: string; errorType: string; modelVersion: string; count: number; wSum: number; wSuccess: number; wFormat: number }>()
  for (const r of reports) {
    const skill = skillSummary(r.skill)
    if (!skill?.id) continue
    const inputBucket = String(r.inputSizeBucket || 'unknown').trim() || 'unknown'
    const errorType = r.success ? 'success' : String(r.errorType || 'unknown_error').trim() || 'unknown_error'
    const modelVersion = reportModelVersion(r)
    const profileKey = `${skill.id}|${inputBucket}|${errorType}|${modelVersion}`
    const current = byProfile.get(profileKey) || { skillId: skill.id, skillSlug: skill.slug, skillTitle: skill.title, inputBucket, errorType, modelVersion, count: 0, wSum: 0, wSuccess: 0, wFormat: 0 }
    const w = r.suppressed ? 0 : decayWeight(r.createdAt, nowMs) * sourceWeight(r.source)
    current.count++
    current.wSum += w
    if (r.success) current.wSuccess += w
    if (r.formatValid) current.wFormat += w
    byProfile.set(profileKey, current)
  }
  return Array.from(byProfile.entries())
    .map(([profileKey, row]) => ({
      profileKey,
      skillId: row.skillId,
      skillSlug: row.skillSlug || null,
      skillTitle: row.skillTitle || null,
      inputBucket: row.inputBucket,
      errorType: row.errorType,
      modelVersion: row.modelVersion === 'unversioned' ? null : row.modelVersion,
      count: row.count,
      effectiveSamples: Math.round(row.wSum * 10) / 10,
      successRate: row.wSum > 0 ? row.wSuccess / row.wSum : 0,
      formatRate: row.wSum > 0 ? row.wFormat / row.wSum : 0,
    }))
    .sort((a, b) => b.effectiveSamples - a.effectiveSamples || b.count - a.count || a.profileKey.localeCompare(b.profileKey))
    .slice(0, limit)
}

async function fetchRecentCompatReports(
  payload: Payload,
  skillId?: string,
  options: { publicSkillOnly?: boolean } = {},
): Promise<any[]> {
  const and: any[] = [{ createdAt: { greater_than_equal: compatLookbackStartISO() } }]
  if (skillId) and.unshift({ skill: { equals: skillId } })
  if (options.publicSkillOnly) {
    and.push({ 'skill.status': { equals: 'published' } })
    and.push({ 'skill.visibility': { equals: 'public' } })
  }
  const docs: any[] = []
  let page = 1
  for (;;) {
    const res = await payload.find({
      collection: 'compat-reports',
      where: { and },
      limit: 500,
      page,
      depth: 0,
      overrideAccess: true,
      sort: 'id',
    })
    docs.push(...(res.docs as any[]))
    if (!res.hasNextPage) break
    page++
  }
  return docs
}

// 由兼容报告聚合重算 Skill 的兼容分（0-100）并写回（衰减加权 × 来源权重 + 置信度衰减）
export async function recomputeLocalScore(payload: Payload, skillId: string) {
  const prevSkill = (await payload
    .findByID({ collection: 'skills', id: skillId, depth: 0, overrideAccess: true })
    .catch(() => null)) as any
  const prevScore: number | null = prevSkill ? prevSkill.localScore ?? 0 : null
  const reports = await fetchRecentCompatReports(payload, skillId)
  let localScore = 0
  if (reports.length > 0) {
    const now = Date.now()
    let wSum = 0
    let wSuccess = 0
    let wFormat = 0
    const models = new Set<string>()
    for (const r of reports) {
      const w = r.suppressed ? 0 : decayWeight(r.createdAt, now) * sourceWeight(r.source)
      wSum += w
      if (r.success) wSuccess += w
      if (r.formatValid) wFormat += w
      if (r.modelName) models.add(r.modelName)
    }
    if (wSum > 0) {
      const successRate = wSuccess / wSum
      const formatRate = wFormat / wSum
      const coverage = Math.min(1, models.size / 3)
      const base = 0.6 * successRate + 0.3 * formatRate + 0.1 * coverage
      // 置信度：有效(衰减)样本不足时按比例衰减分数，杜绝 N=1 的 100% 噪声霸榜
      const confidence = Math.min(1, wSum / CONF_FULL_N)
      localScore = Math.round(100 * base * confidence)
    }
  }
  await payload.update({
    collection: 'skills',
    id: skillId,
    data: { localScore },
    overrideAccess: true,
  })
  // 6j-2 信任加固：分数变化时落一条 ed25519 签名的 append-only 快照，改历史必留痕。失败不影响主流程。
  try {
    if (localScore !== (prevScore ?? -1)) {
      await writeScoreSnapshot(payload, skillId, localScore, reports.length)
    }
  } catch (e) {
    payload.logger?.error(`writeScoreSnapshot 失败: ${(e as Error).message}`)
  }
  // 护城河第1层(#15)：由真实回流回写成本优化路由，让"数据改变产品动作"而非只改展示。失败不影响 localScore。
  try {
    await recomputeRoutePolicy(payload, skillId)
  } catch (e) {
    payload.logger?.error(`recomputeRoutePolicy 失败: ${(e as Error).message}`)
  }
  return localScore
}

// 6j-2：写一条 ed25519 签名的 append-only 分数快照。无签名密钥时仍落记录(带哈希)，仅 signature 为空。
async function writeScoreSnapshot(
  payload: Payload,
  skillId: string,
  localScore: number,
  reportCount: number,
): Promise<void> {
  const signedAt = new Date().toISOString()
  const core = { skill: String(skillId), localScore, reportCount, signedAt }
  const canon = canonicalString(core)
  const payloadHash = createHash('sha256').update(canon).digest('hex')
  const runtimeEnv = await resolveRuntimeEnv(payload)
  const signature = signCanonical(core, runtimeEnv) // 无密钥返回 null
  const keyId = getSigningKeyId(runtimeEnv) // 无密钥返回 null
  await payload.create({
    collection: 'score-snapshots',
    overrideAccess: true,
    data: {
      skill: skillId,
      localScore,
      reportCount,
      payloadHash,
      keyId: keyId || undefined,
      signature: signature || undefined,
      signedAt,
    },
  })
}
// 只写 dataDriven 子键、不动作者手填的 strategies/default；无足够数据(可用模型为空)则不动作，保留作者意图。
export async function recomputeRoutePolicy(payload: Payload, skillId: string): Promise<void> {
  const models = await aggregateByModel(payload, skillId)
  const ranked = rankDataDrivenRoute(
    models.map((m) => ({
      modelName: m.modelName,
      successRate: m.successRate,
      avgLatencyMs: m.avgLatencyMs,
      formatRate: m.formatRate,
      lowSample: m.lowSample,
    })),
  )
  if (!ranked.cheap.length && !ranked.fast.length && !ranked.quality.length) return // 无够样本可用模型，保留作者手填

  const skill = (await payload
    .findByID({ collection: 'skills', id: skillId, depth: 0, overrideAccess: true })
    .catch(() => null)) as any
  const versionId = skill && (typeof skill.currentVersion === 'object' ? skill.currentVersion?.id : skill.currentVersion)
  if (!versionId) return
  const version = (await payload
    .findByID({ collection: 'skill-versions', id: versionId, depth: 0, overrideAccess: true })
    .catch(() => null)) as any
  if (!version) return

  const rp = version.routePolicy && typeof version.routePolicy === 'object' ? { ...version.routePolicy } : {}
  rp.dataDriven = {
    cheap: ranked.cheap,
    fast: ranked.fast,
    quality: ranked.quality,
    recomputedAt: new Date().toISOString(),
  }
  await payload.update({
    collection: 'skill-versions',
    id: versionId,
    data: { routePolicy: rp },
    overrideAccess: true,
  })
}

// 按模型聚合（详情页展示用）
export interface ModelCompat {
  modelName: string
  modelProfile?: string
  modelVersion?: string
  reports: number
  verified: number
  successRate: number
  formatRate: number
  avgLatencyMs: number
  lowSample: boolean // 样本不足：前端应显示"战绩积累中"而非百分比
  effectiveSamples?: number // 衰减×来源权重后的有效样本量，用于解释数据可信度
  sourceSummary?: CompatSourceSummary[]
}

function relationshipId(value: unknown): string | undefined {
  if (!value) return undefined
  if (typeof value === 'object') {
    const id = (value as any).id
    return id ? String(id) : undefined
  }
  return String(value)
}

function reportModelIdentity(report: any): { key: string; modelName: string; modelProfile?: string; modelVersion?: string } {
  const modelProfile = relationshipId(report.modelProfile)
  const profile = report.modelProfile && typeof report.modelProfile === 'object' ? report.modelProfile : null
  const modelName = String(profile?.modelName || report.modelName || 'unknown')
  const modelVersion = profile?.modelVersion || report.modelVersion ? String(profile?.modelVersion || report.modelVersion) : undefined
  return {
    key: modelProfile ? `profile:${modelProfile}` : `name:${modelName}::version:${modelVersion || ''}`,
    modelName,
    modelProfile,
    modelVersion,
  }
}

export async function aggregateByModel(payload: Payload, skillId: string): Promise<ModelCompat[]> {
  const reports = await fetchRecentCompatReports(payload, skillId)
  const now = Date.now()
  const byModel = new Map<string, { identity: ReturnType<typeof reportModelIdentity>; reports: any[] }>()
  for (const r of reports) {
    const identity = reportModelIdentity(r)
    if (!byModel.has(identity.key)) byModel.set(identity.key, { identity, reports: [] })
    byModel.get(identity.key)!.reports.push(r)
  }
  const out: ModelCompat[] = []
  for (const { identity, reports: rs } of byModel.values()) {
    let wSum = 0
    let wSuccess = 0
    let wFormat = 0
    let wLatency = 0
    let wLatencySum = 0
    for (const r of rs) {
      const w = r.suppressed ? 0 : decayWeight(r.createdAt, now) * sourceWeight(r.source)
      wSum += w
      if (r.success) wSuccess += w
      if (r.formatValid) wFormat += w
      if (typeof r.latencyMs === 'number') {
        wLatency += w * r.latencyMs
        wLatencySum += w
      }
    }
    out.push({
      modelName: identity.modelName,
      modelProfile: identity.modelProfile,
      modelVersion: identity.modelVersion,
      reports: rs.length,
      verified: rs.filter((r) => r.source === 'verified').length,
      successRate: wSum > 0 ? wSuccess / wSum : 0,
      formatRate: wSum > 0 ? wFormat / wSum : 0,
      avgLatencyMs: wLatencySum > 0 ? Math.round(wLatency / wLatencySum) : 0,
      lowSample: rs.length < MIN_MODEL_SAMPLE,
      effectiveSamples: Math.round(wSum * 10) / 10,
      sourceSummary: summarizeSources(rs),
    })
  }
  return out.sort((a, b) => b.reports - a.reports)
}

// 跨全站按模型聚合（中立模型榜用）：衰减×来源权重加权，返回逐模型全局实测事实。
export interface GlobalModelStat {
  model: string
  modelProfile?: string
  modelVersion?: string
  successRate: number
  formatRate: number
  avgLatencyMs: number
  samples: number
  effectiveSamples?: number
  sourceSummary?: CompatSourceSummary[]
  inputBucketSummary?: CompatInputBucketSummary[]
  taskProfileSummary?: CompatTaskProfileSummary[]
  skillProfileSummary?: CompatSkillProfileSummary[]
}
export async function aggregateModelsGlobal(
  payload: Payload,
  options: { publicSkillOnly?: boolean } = {},
): Promise<GlobalModelStat[]> {
  const now = Date.now()
  const byModel = new Map<
    string,
    {
      identity: ReturnType<typeof reportModelIdentity>
      wSum: number
      wSuccess: number
      wFormat: number
      wLat: number
      wLatSum: number
      n: number
      reports: any[]
    }
  >()
  for (const r of await fetchRecentCompatReports(payload, undefined, options)) {
    const identity = reportModelIdentity(r)
    if (!identity.modelName) continue
    const a = byModel.get(identity.key) || {
      identity,
      wSum: 0,
      wSuccess: 0,
      wFormat: 0,
      wLat: 0,
      wLatSum: 0,
      n: 0,
      reports: [],
    }
    const w = r.suppressed ? 0 : decayWeight(r.createdAt, now) * sourceWeight(r.source)
    a.wSum += w
    if (r.success) a.wSuccess += w
    if (r.formatValid) a.wFormat += w
    if (typeof r.latencyMs === 'number') {
      a.wLat += w * r.latencyMs
      a.wLatSum += w
    }
    a.n++
    a.reports.push(r)
    byModel.set(identity.key, a)
  }
  const out: GlobalModelStat[] = []
  for (const a of byModel.values()) {
    out.push({
      model: a.identity.modelName,
      modelProfile: a.identity.modelProfile,
      modelVersion: a.identity.modelVersion,
      successRate: a.wSum > 0 ? a.wSuccess / a.wSum : 0,
      formatRate: a.wSum > 0 ? a.wFormat / a.wSum : 0,
      avgLatencyMs: a.wLatSum > 0 ? Math.round(a.wLat / a.wLatSum) : 0,
      samples: a.n,
      effectiveSamples: Math.round(a.wSum * 10) / 10,
      sourceSummary: summarizeSources(a.reports),
      inputBucketSummary: summarizeInputBuckets(a.reports, now),
      taskProfileSummary: summarizeTaskProfiles(a.reports, now),
      skillProfileSummary: summarizeSkillProfiles(a.reports, now),
    })
  }
  return out
}
