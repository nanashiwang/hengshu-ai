import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'
import { encryptSecret } from '@/lib/secrets'
import { runnerTokenExpiresAt, runnerTokenHash } from '@/lib/runnerAuth'

const APPLY = process.argv.includes('--apply')

async function migrateUserKeys(payload: any) {
  let page = 1
  let scanned = 0
  let pending = 0
  for (;;) {
    const res = await payload.find({ collection: 'users', limit: 100, page, depth: 0, overrideAccess: true, sort: 'id' })
    for (const u of res.docs as any[]) {
      scanned++
      const raw = String(u.newapiKeyEncrypted || '').trim()
      if (!raw || raw.startsWith('enc:v1:')) continue
      pending++
      if (APPLY) {
        await payload.update({
          collection: 'users',
          id: u.id,
          data: { newapiKeyEncrypted: encryptSecret(raw) },
          overrideAccess: true,
        })
      }
    }
    if (!res.hasNextPage) break
    page++
  }
  payload.logger.info(`用户 BYOK 加密迁移：扫描 ${scanned}，待处理 ${pending}${APPLY ? '（已写回）' : '（dry-run）'}`)
}

async function migrateRunnerTokens(payload: any) {
  let page = 1
  let scanned = 0
  let pending = 0
  for (;;) {
    const res = await payload.find({ collection: 'runner-clients', limit: 100, page, depth: 0, overrideAccess: true, sort: 'id' })
    for (const r of res.docs as any[]) {
      scanned++
      const raw = String(r.token || '').trim()
      if (!raw) continue
      pending++
      if (APPLY) {
        await payload.update({
          collection: 'runner-clients',
          id: r.id,
          data: {
            tokenHash: r.tokenHash || runnerTokenHash(raw),
            tokenExpiresAt: r.tokenExpiresAt || runnerTokenExpiresAt(),
            token: null,
          },
          overrideAccess: true,
        })
      }
    }
    if (!res.hasNextPage) break
    page++
  }
  payload.logger.info(`Runner token 哈希迁移：扫描 ${scanned}，待处理 ${pending}${APPLY ? '（已写回并清除明文）' : '（dry-run）'}`)
}

async function main() {
  const payload = await getPayload({ config })
  await migrateUserKeys(payload)
  await migrateRunnerTokens(payload)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
