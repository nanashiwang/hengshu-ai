import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'
import { applyCredit } from '@/lib/credit'
import { getEconomyConfig } from '@/lib/economy'
import { syncNewApiQuotaToBalance } from '@/lib/newapiQuota'
import { normalizeRegisterCreditAmount, registerCreditIdempotencyKey } from '@/lib/registerCredit'

const APPLY = process.argv.includes('--apply')
const LIMIT = Math.max(1, Number(process.env.BACKFILL_REGISTER_CREDIT_PAGE_SIZE || 100))

async function hasRegisterGrant(payload: any, userId: string): Promise<boolean> {
  const res = await payload.count({
    collection: 'credit-logs',
    where: { idempotencyKey: { equals: registerCreditIdempotencyKey(userId) } },
    overrideAccess: true,
  })
  return res.totalDocs > 0
}

async function main() {
  const payload = await getPayload({ config })
  const eco = await getEconomyConfig(payload)
  const free = normalizeRegisterCreditAmount(eco.freeCreditOnRegister)
  if (free <= 0) {
    payload.logger.warn('freeCreditOnRegister 为 0，注册赠送补账无需执行')
    process.exit(0)
  }

  let page = 1
  let scanned = 0
  let missing = 0
  let granted = 0
  let skipped = 0
  let failed = 0

  for (;;) {
    const users = await payload.find({
      collection: 'users',
      depth: 0,
      limit: LIMIT,
      page,
      sort: 'id',
      overrideAccess: true,
    })

    for (const u of users.docs as any[]) {
      scanned++
      const userId = String(u.id)
      if (await hasRegisterGrant(payload, userId)) {
        skipped++
        continue
      }
      missing++
      if (!APPLY) continue

      const grant = await applyCredit(payload, {
        userId,
        type: 'adjust',
        amount: free,
        description: '注册赠送额度补账',
        idempotencyKey: registerCreditIdempotencyKey(userId),
      })
      if (!grant.ok) {
        failed++
        payload.logger.error(`注册赠送补账失败 user=${userId}: ${grant.error || '未知错误'}`)
        continue
      }
      if (grant.skipped) {
        skipped++
        continue
      }
      granted++
      syncNewApiQuotaToBalance(payload, userId).catch((e) =>
        payload.logger?.error(`注册赠送补账后网关配额同步失败 user=${userId}: ${(e as Error).message}`),
      )
    }

    if (!users.hasNextPage) break
    page++
  }

  payload.logger.info(
    `注册赠送补账${APPLY ? '' : '(dry-run)'}：扫描 ${scanned}，缺失 ${missing}，已补 ${granted}，已跳过 ${skipped}，失败 ${failed}`,
  )
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
