import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'
import { aggregateFailureKnowledge } from '@/lib/failureKnowledge'
import { buildFailureCaseData, upsertFailureCase } from '@/lib/failureCase'

async function main() {
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: 'compat-reports',
    depth: 1,
    limit: 5000,
    overrideAccess: true,
    sort: '-createdAt',
  })
  const groups = aggregateFailureKnowledge(res.docs as any[], 200)
  let processed = 0
  for (const g of groups) {
    await upsertFailureCase(payload, buildFailureCaseData(g))
    processed++
  }
  payload.logger.info(`FailureCase 聚类完成：processed=${processed}`)
  process.exit(0)
}

main().catch((e) => {
  console.error('FailureCase 聚类失败：', e)
  process.exit(1)
})
