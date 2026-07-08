import { getPayload } from 'payload'
import config from '@payload-config'
import { runnerFromBearer } from '@/lib/runnerAuth'
import { activeInstallMatchesCurrentVersion, findActiveInstall, resolvePublishedSkill } from '@/lib/installs'
import { anonHash, recomputeLocalScore } from '@/lib/compat'
import { awardContribution } from '@/lib/contribution'
import { ensureModelProfile } from '@/lib/modelProfile'
import { refreshSkillPassport } from '@/lib/passportRefresh'
import { refreshFailureCasesForSkill } from '@/lib/failureRefresh'
import { readJsonBodyWithLimit } from '@/lib/requestBody'
import { MAX_RUNNER_REPORT_REQUEST_BYTES, normalizeRunnerCompatReport } from '@/lib/runnerReportRequest'

// POST /v1/runner/report (Bearer) —— 提交本地模型兼容报告
// 仅接受可聚合指标，绝不存输入/输出原文。anon=true 时只存匿名哈希、不关联用户。
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const actor = await runnerFromBearer(payload, request)
  if (!actor) return Response.json({ error: '未登录或令牌无效' }, { status: 401 })

  const parsed = await readJsonBodyWithLimit(request, MAX_RUNNER_REPORT_REQUEST_BYTES, '兼容报告请求体过大')
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const normalized = normalizeRunnerCompatReport(parsed.value)
  if (!normalized.ok) return Response.json({ error: normalized.error }, { status: normalized.status })
  const report = normalized.value

  const resolved = await resolvePublishedSkill(payload, report.slug)
  if (!resolved) return Response.json({ error: 'Skill 不存在' }, { status: 404 })
  const install = await findActiveInstall(payload, actor.user.id, resolved.skill.id, actor.runner.id)
  if (!install) {
    return Response.json({ error: '请先通过当前 Runner 安装该 Skill，再提交兼容报告' }, { status: 403 })
  }
  if (!activeInstallMatchesCurrentVersion(install, resolved.version, report.checksum)) {
    return Response.json({ error: '本地安装版本已过期，请先更新该 Skill 后再提交兼容报告' }, { status: 409 })
  }

  const anon = report.anon
  const isVerified = actor.runner.trustedLevel === 'verified'
  const modelName = report.modelName
  const modelProvider = report.modelProvider
  const modelVersion = report.modelVersion
  const modelProfile = await ensureModelProfile(payload, modelName, modelProvider, modelVersion).catch(() => undefined)
  // 白名单：仅以下字段会被存储
  await payload.create({
    collection: 'compat-reports',
    overrideAccess: true,
    data: {
      skill: resolved.skill.id,
      skillVersion: resolved.version.id,
      runner: anon ? undefined : actor.runner.id,
      anonymousUserHash: anon ? anonHash(actor.runner.runnerId) : undefined,
      modelProvider,
      modelName,
      modelProfile,
      modelVersion,
      success: report.success,
      latencyMs: report.latencyMs,
      formatValid: report.formatValid,
      errorType: report.errorType,
      inputSizeBucket: report.inputSizeBucket,
      outputSizeBucket: report.outputSizeBucket,
      runnerVersion: actor.runner.runnerVersion,
      source: isVerified ? 'verified' : 'community',
    },
  })

  const localScore = await recomputeLocalScore(payload, resolved.skill.id)
  await refreshSkillPassport(payload, String(resolved.skill.id)).catch((e) =>
    payload.logger?.error(`Runner 回流刷新 Passport 失败: ${(e as Error).message}`),
  )
  if (report.errorType) {
    await refreshFailureCasesForSkill(payload, String(resolved.skill.id)).catch((e) =>
      payload.logger?.error(`Runner 回流刷新 FailureCase 失败: ${(e as Error).message}`),
    )
  }

  // 信任模型：仅 verified Runner 的具名报告计贡献值（社区报告仅展示）
  let rewarded = false
  if (isVerified && !anon) {
    await awardContribution(payload, {
      userId: actor.user.id,
      actionType: 'compat_report',
      relatedSkill: resolved.skill.id,
      description: `提交「${resolved.skill.title}」兼容报告`,
    })
    rewarded = true
  }

  return Response.json({ ok: true, localScore, rewarded })
}
