import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'
import { skillRankFromAggregates } from '../lib/skillrank'

// 批量重算所有 Skill 的可信分 / 健康度（可手动或定时执行）。
// 运行：npm run worker:skillrank
async function run() {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'skills',
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })

  let updated = 0
  for (const s of docs as any[]) {
    const passports = await payload.find({
      collection: 'skill-passports' as any,
      where: {
        and: [
          { skill: { equals: s.id } },
          { status: { equals: 'current' } },
        ],
      },
      limit: 1,
      depth: 0,
      sort: '-lastVerifiedAt',
      overrideAccess: true,
    })
    const passport = passports.docs[0] as any
    const trustedCompatibleRunCount =
      passport?.reliabilitySummary?.trustedCompatibleRunCount ??
      passport?.evidenceSummary?.trustedCompatibleRunCount
    const rank = skillRankFromAggregates({
      successRate: s.successRate,
      avgCost: s.avgCost,
      avgLatencyMs: s.avgLatencyMs,
      formatSuccessRate: s.formatSuccessRate,
      avgRating: s.avgRating,
      trustedCompatibleRunCount,
      lastUpdatedAt: s.lastUpdatedAt,
    })
    await payload.update({
      collection: 'skills',
      id: s.id,
      data: { skillRank: rank, healthScore: rank },
      overrideAccess: true,
    })
    updated++
  }

  payload.logger.info(`可信分重算完成：${updated} 个 Skill`)
  process.exit(0)
}

run().catch((e) => {
  console.error('可信分重算失败：', e)
  process.exit(1)
})
