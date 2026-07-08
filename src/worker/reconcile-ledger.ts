import 'dotenv/config'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '../payload.config'

// 台账对账 worker：从真值源重算，修复增量写入(read-modify-write)在并发下的丢更新漂移。
//   ① 贡献值：contributionScore == SUM(contribution-logs.points)
//   ② Skill 指标：runCount/successRate/avgCost/avgLatencyMs/formatSuccessRate 由 skill-runs 重算
//   ③ credit：creditBalance == SUM(credit-logs.amount)（资金不变量）
//   ④ 计数：favoriteCount=COUNT(favorites)，reviewCount/avgRating 由 visible reviews 重算
// 默认 dry-run 只报漂移；加 --apply（或 APPLY=1）才写回。
//   运行：npm run worker:reconcile          # 只看漂移
//        npm run worker:reconcile -- --apply # 应用修复
// ⚠️ 不对账 skillRank/healthScore：其 recency 分量依赖 wall-clock(Date.now())，非 skill-runs 可唯一重算的量；
//    rank 交给 `npm run worker:skillrank` 单独负责，避免三方口径永不收敛而反复误改。
const APPLY = process.argv.includes('--apply') || process.env.APPLY === '1'
const round4 = (n: number) => Math.round(n * 10000) / 10000
const round2 = (n: number) => Math.round(n * 100) / 100
// 浮点容差：热路径 updateSkillMetrics 用逐步舍入的滑动平均(累积误差)，reconciler 用一次性 sum/count；
// 仅当差异超出容差才判漂移，避免常态性误报与无谓写回。
const RATE_EPS = 5e-5 // 比率类(0-1)
const LAT_EPS = 1 // 平均耗时(ms) 允许 ±1 的累积取整差

// 分页遍历一个集合，逐条回调（sort:id 保证分页稳定；只读不改，避免翻页错位）
async function forEachDoc(payload: Payload, collection: any, cb: (doc: any) => void) {
  const limit = 500
  let page = 1
  for (;;) {
    const res = await payload.find({ collection, limit, page, depth: 0, overrideAccess: true, sort: 'id' })
    for (const d of res.docs as any[]) cb(d)
    if (!res.hasNextPage) break
    page++
  }
}

// ① 贡献值台账对账
async function reconcileLedger(payload: Payload) {
  const sums = new Map<string, number>()
  await forEachDoc(payload, 'contribution-logs', (d) => {
    const uid = typeof d.user === 'object' ? d.user?.id : d.user
    if (!uid) return
    sums.set(String(uid), (sums.get(String(uid)) || 0) + (d.points || 0))
  })

  const users: any[] = []
  await forEachDoc(payload, 'users', (u) => users.push(u))

  let drifted = 0
  let totalAbsDrift = 0
  for (const u of users) {
    const expected = round4(sums.get(String(u.id)) || 0)
    const actual = round4(u.contributionScore || 0)
    if (Math.abs(expected - actual) < 1e-6) continue
    drifted++
    totalAbsDrift += Math.abs(expected - actual)
    payload.logger.warn(
      `贡献值漂移 user=${u.id}(${u.username || '—'}): 账面 ${actual} → 应为 ${expected} (Δ${round4(expected - actual)})`,
    )
    if (APPLY) {
      await payload.update({
        collection: 'users',
        id: u.id,
        data: { contributionScore: expected },
        overrideAccess: true,
      })
    }
  }
  payload.logger.info(
    `贡献值对账：用户 ${users.length}，漂移 ${drifted}，累计绝对漂移 ${round4(totalAbsDrift)}${APPLY ? '（已修复）' : '（dry-run，未写回）'}`,
  )
}

// ② Skill 指标重算
async function reconcileSkillMetrics(payload: Payload) {
  type Agg = { count: number; success: number; cost: number; latency: number; format: number }
  const agg = new Map<string, Agg>()
  await forEachDoc(payload, 'skill-runs', (r) => {
    // 只统计计入指标的运行；对比/探测运行(countedInMetrics=false)按热路径 skipAggregate 语义排除
    if (r.countedInMetrics === false) return
    const sid = typeof r.skill === 'object' ? r.skill?.id : r.skill
    if (!sid) return
    const a = agg.get(String(sid)) || { count: 0, success: 0, cost: 0, latency: 0, format: 0 }
    a.count++
    a.success += r.success ? 1 : 0
    a.cost += r.estimatedCost || 0
    a.latency += r.latencyMs || 0
    a.format += r.formatValid ? 1 : 0
    agg.set(String(sid), a)
  })

  const skills: any[] = []
  await forEachDoc(payload, 'skills', (s) => skills.push(s))

  let drifted = 0
  for (const s of skills) {
    const a = agg.get(String(s.id))
    const runCount = a?.count || 0
    const successRate = runCount ? round4(a!.success / runCount) : 0
    const avgCost = runCount ? round4(a!.cost / runCount) : 0
    const avgLatencyMs = runCount ? Math.round(a!.latency / runCount) : 0
    const formatSuccessRate = runCount ? round4(a!.format / runCount) : 0

    const changed =
      runCount !== (s.runCount || 0) ||
      Math.abs(successRate - round4(s.successRate || 0)) > RATE_EPS ||
      Math.abs(avgCost - round4(s.avgCost || 0)) > RATE_EPS ||
      Math.abs(avgLatencyMs - (s.avgLatencyMs || 0)) > LAT_EPS ||
      Math.abs(formatSuccessRate - round4(s.formatSuccessRate || 0)) > RATE_EPS
    if (!changed) continue
    drifted++
    payload.logger.warn(
      `指标漂移 skill=${s.slug || s.id}: runCount ${s.runCount || 0}→${runCount} successRate ${round4(s.successRate || 0)}→${successRate} avgCost ${round4(s.avgCost || 0)}→${avgCost} avgLatency ${s.avgLatencyMs || 0}→${avgLatencyMs}`,
    )
    if (APPLY) {
      await payload.update({
        collection: 'skills',
        id: s.id,
        // 只回写 skill-runs 可唯一重算的量；skillRank/healthScore 交给 worker:skillrank
        data: { runCount, successRate, avgCost, avgLatencyMs, formatSuccessRate },
        overrideAccess: true,
      })
    }
  }
  payload.logger.info(
    `指标对账：Skill ${skills.length}，漂移 ${drifted}${APPLY ? '（已修复）' : '（dry-run，未写回）'}`,
  )
}

// ③ credit 台账对账：creditBalance == SUM(credit-logs.amount)（唯一写入点 applyCredit 必记等额流水）
async function reconcileCredit(payload: Payload) {
  const sums = new Map<string, number>()
  await forEachDoc(payload, 'credit-logs', (d) => {
    const uid = typeof d.user === 'object' ? d.user?.id : d.user
    if (!uid) return
    sums.set(String(uid), (sums.get(String(uid)) || 0) + (d.amount || 0))
  })
  const users: any[] = []
  await forEachDoc(payload, 'users', (u) => users.push(u))
  let drifted = 0
  let totalAbsDrift = 0
  for (const u of users) {
    const expected = round2(sums.get(String(u.id)) || 0)
    const actual = round2(u.creditBalance || 0)
    if (Math.abs(expected - actual) < 1e-6) continue
    drifted++
    totalAbsDrift += Math.abs(expected - actual)
    payload.logger.warn(`credit 漂移 user=${u.id}(${u.username || '—'}): 账面 ${actual} → 应为 ${expected}`)
    if (APPLY) {
      await payload.update({ collection: 'users', id: u.id, data: { creditBalance: expected }, overrideAccess: true })
    }
  }
  payload.logger.info(
    `credit 对账：用户 ${users.length}，漂移 ${drifted}，累计绝对漂移 ${round2(totalAbsDrift)}${APPLY ? '（已修复）' : '（dry-run，未写回）'}`,
  )
}

// ④ 计数对账：favoriteCount=COUNT(favorites)；reviewCount/avgRating 由 visible reviews 重算（口径对齐 recomputeSkillRating）
async function reconcileCounts(payload: Payload) {
  const favBySkill = new Map<string, number>()
  await forEachDoc(payload, 'favorites', (f) => {
    const sid = typeof f.skill === 'object' ? f.skill?.id : f.skill
    if (!sid) return
    favBySkill.set(String(sid), (favBySkill.get(String(sid)) || 0) + 1)
  })
  const revBySkill = new Map<string, { count: number; ratingSum: number; ratingN: number }>()
  await forEachDoc(payload, 'reviews', (r) => {
    if (r.status !== 'visible') return // 口径对齐：仅可见评论计入
    const sid = typeof r.skill === 'object' ? r.skill?.id : r.skill
    if (!sid) return
    const a = revBySkill.get(String(sid)) || { count: 0, ratingSum: 0, ratingN: 0 }
    a.count++
    if (typeof r.rating === 'number' && r.rating > 0) {
      a.ratingSum += r.rating
      a.ratingN++
    }
    revBySkill.set(String(sid), a)
  })
  const skills: any[] = []
  await forEachDoc(payload, 'skills', (s) => skills.push(s))
  let drifted = 0
  for (const s of skills) {
    const favoriteCount = favBySkill.get(String(s.id)) || 0
    const rev = revBySkill.get(String(s.id))
    const reviewCount = rev?.count || 0
    const avgRating = rev && rev.ratingN > 0 ? round2(rev.ratingSum / rev.ratingN) : 0
    const changed =
      favoriteCount !== (s.favoriteCount || 0) ||
      reviewCount !== (s.reviewCount || 0) ||
      Math.abs(avgRating - round2(s.avgRating || 0)) > 1e-6
    if (!changed) continue
    drifted++
    payload.logger.warn(
      `计数漂移 skill=${s.slug || s.id}: fav ${s.favoriteCount || 0}→${favoriteCount} review ${s.reviewCount || 0}→${reviewCount} rating ${round2(s.avgRating || 0)}→${avgRating}`,
    )
    if (APPLY) {
      await payload.update({
        collection: 'skills',
        id: s.id,
        data: { favoriteCount, reviewCount, avgRating },
        overrideAccess: true,
      })
    }
  }
  payload.logger.info(
    `计数对账：Skill ${skills.length}，漂移 ${drifted}${APPLY ? '（已修复）' : '（dry-run，未写回）'}`,
  )
}

async function run() {
  const payload = await getPayload({ config })
  payload.logger.info(`台账对账启动（${APPLY ? 'APPLY 写回模式' : 'dry-run 只报账'}）`)
  await reconcileLedger(payload)
  await reconcileCredit(payload)
  await reconcileSkillMetrics(payload)
  await reconcileCounts(payload)
  payload.logger.info('台账对账完成')
  process.exit(0)
}

run().catch((e) => {
  console.error('台账对账失败：', e)
  process.exit(1)
})
