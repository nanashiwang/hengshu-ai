import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'
import { aggregateModelsGlobal } from '@/lib/compat'
import { buildModelProfileData, upsertModelProfile } from '@/lib/modelProfile'

function latestPrices(prices: any[]) {
  const byModel = new Map<string, any>()
  for (const p of prices) {
    if (!p?.model) continue
    const key = `${p.model}::${p.modelVersion || ''}`
    const prev = byModel.get(key)
    const t = new Date(p.capturedAt || p.updatedAt || p.createdAt || 0).getTime()
    const pt = prev ? new Date(prev.capturedAt || prev.updatedAt || prev.createdAt || 0).getTime() : -1
    if (!prev || t >= pt) byModel.set(key, p)
  }
  return byModel
}

function modelKey(modelName: string, modelVersion?: string) {
  return `${modelName}::${modelVersion || ''}`
}

async function main() {
  const payload = await getPayload({ config })
  const [stats, prices] = await Promise.all([
    aggregateModelsGlobal(payload),
    payload.find({
      collection: 'model-price-snapshots',
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    }),
  ])
  const priceByModel = latestPrices(prices.docs as any[])
  const statByModel = new Map(stats.map((s) => [modelKey(s.model, s.modelVersion), s]))
  const modelKeys = new Set<string>([...statByModel.keys(), ...priceByModel.keys()])

  let processed = 0
  for (const key of modelKeys) {
    const [modelName, modelVersion] = key.split('::')
    await upsertModelProfile(
      payload,
      buildModelProfileData({
        modelName,
        modelVersion: modelVersion || undefined,
        stat: statByModel.get(key),
        price: priceByModel.get(key),
      }),
    )
    processed++
  }

  payload.logger.info(`Model Profile 刷新完成：processed=${processed}`)
  process.exit(0)
}

main().catch((e) => {
  console.error('Model Profile 刷新失败：', e)
  process.exit(1)
})
