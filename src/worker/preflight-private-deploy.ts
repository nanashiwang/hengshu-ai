import 'dotenv/config'
import { checkPrivateDeployEnv, countBlockers } from '@/lib/productionPreflight'

const issues = checkPrivateDeployEnv()
for (const issue of issues) {
  const line = `私有部署 readiness ${issue.level === 'blocker' ? '失败' : '提示'} [${issue.code}] ${issue.message}`
  if (issue.level === 'blocker') console.error(line)
  else console.warn(line)
}
const blockers = countBlockers(issues)
if (blockers > 0) {
  console.error(`私有部署 readiness 未通过：发现 ${blockers} 个阻断项；请先修正 .env.nas / Compose 配置`)
  process.exit(2)
}
console.log('私有部署 readiness 通过：可继续 docker compose up -d --build；公网生产仍需执行 worker:preflight-production')
