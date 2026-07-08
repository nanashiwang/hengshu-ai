import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'
import { refreshSkillPassport } from '@/lib/passportRefresh'

async function main() {
  const payload = await getPayload({ config })
  let page = 1
  let processed = 0
  let skipped = 0

  for (;;) {
    const res = await payload.find({
      collection: 'skills',
      limit: 100,
      page,
      depth: 1,
      overrideAccess: true,
      sort: 'createdAt',
    })

    for (const skill of res.docs as any[]) {
      const passport = await refreshSkillPassport(payload, String(skill.id))
      if (!passport) {
        skipped++
        continue
      }
      processed++
    }

    if (!res.hasNextPage) break
    page++
  }

  payload.logger.info(`Skill Passport 回填完成：processed=${processed} skipped=${skipped}`)
  process.exit(0)
}

main().catch((e) => {
  console.error('Skill Passport 回填失败：', e)
  process.exit(1)
})
