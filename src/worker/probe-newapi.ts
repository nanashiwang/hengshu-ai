import 'dotenv/config'
import { classifyNewApiProbe, redactNewApiProbeText, runNewApiPermissionProbe } from '@/lib/newapiProbe'

async function main() {
  const checks = await runNewApiPermissionProbe()
  for (const c of checks) console.log(JSON.stringify(c))
  const { tokenOK, logOK, logFilterOK, logTimeFilterOK, logSettlementOK, pricingOK, statusOK, logScope, hint } =
    classifyNewApiProbe(checks)
  console.error(hint)
  if (!tokenOK || !logOK || !logFilterOK || !logTimeFilterOK || !logSettlementOK || !pricingOK || !statusOK) {
    console.error(
      `New API 权限不足：token=${tokenOK ? 'ok' : 'fail'} log=${logOK ? 'ok' : 'fail'} logScope=${logScope} logFilter=${logFilterOK ? 'ok' : 'fail'} logTimeFilter=${logTimeFilterOK ? 'ok' : 'fail'} logSettlement=${logSettlementOK ? 'ok' : 'fail'} pricing=${pricingOK ? 'ok' : 'fail'} status=${statusOK ? 'ok' : 'fail'}`,
    )
    process.exit(2)
  }
  process.exit(0)
}

main().catch((e) => {
  console.error(redactNewApiProbeText((e as Error).message))
  process.exit(1)
})
