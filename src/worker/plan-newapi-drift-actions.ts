import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import {
  buildDriftRemediationPlan,
  formatDriftRemediationPlanJsonl,
  parseUserUsageDriftJsonl,
} from '@/lib/newapiDriftRemediation'

async function main() {
  const path = process.argv.slice(2).find((arg) => !arg.startsWith('-')) || process.env.NEWAPI_RECONCILE_DRIFT_REPORT_PATH
  if (!path?.trim()) {
    console.error('用法：npm run worker:plan-newapi-drift -- .reconcile-reports/newapi-drift-YYYY-MM.jsonl')
    process.exit(2)
  }
  const rows = parseUserUsageDriftJsonl(await readFile(path, 'utf8'))
  const steps = buildDriftRemediationPlan(rows)
  const out = formatDriftRemediationPlanJsonl(steps)
  if (out) console.log(out)
  console.error(`New API 漂移处理 dry-run：输入 ${rows.length} 行，输出 ${steps.length} 条人工动作；未修改数据库/网关`)
  process.exit(0)
}

main().catch((e) => {
  console.error((e as Error).message)
  process.exit(1)
})
