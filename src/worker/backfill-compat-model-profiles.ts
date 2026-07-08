import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'
import { ensureModelProfile } from '@/lib/modelProfile'

async function main() {
  const payload = await getPayload({ config })
  let page = 1
  let scanned = 0
  let updated = 0
  let skipped = 0

  for (;;) {
    const res = await payload.find({
      collection: 'compat-reports',
      limit: 500,
      page,
      depth: 0,
      overrideAccess: true,
      sort: 'createdAt',
    })

    for (const r of res.docs as any[]) {
      scanned++
      if (!r.modelName || r.modelProfile) {
        skipped++
        continue
      }
      const modelProfile = await ensureModelProfile(payload, r.modelName, r.modelProvider, r.modelVersion).catch(() => undefined)
      if (!modelProfile) {
        skipped++
        continue
      }
      await payload.update({
        collection: 'compat-reports',
        id: r.id,
        data: { modelProfile },
        overrideAccess: true,
      })
      updated++
    }

    if (!res.hasNextPage) break
    page++
  }

  payload.logger.info(`CompatReports modelProfile 回填完成：scanned=${scanned} updated=${updated} skipped=${skipped}`)
  process.exit(0)
}

main().catch((e) => {
  console.error('CompatReports modelProfile 回填失败：', e)
  process.exit(1)
})
