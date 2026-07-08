import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { runSkill } from '@/lib/skillRunner'
import { decryptSecret } from '@/lib/secrets'
import { canRerunPrivateLedgerSkill } from '@/lib/skillEvidenceAccess'
import { isUsableSkillVersionForPublicEvidence, resolveCurrentSkillVersionForPublicEvidence } from '@/lib/skillVersionPublic'
import { readJsonBodyWithLimit } from '@/lib/requestBody'
import {
  isValidationError,
  MAX_SKILL_RUN_REQUEST_BYTES,
  normalizeOptionalModelProvider,
  normalizeOptionalModelVersion,
  normalizeRerunModel,
} from '@/lib/skillRunRequest'

// POST /v1/runs/{id}/rerun  { model } —— 用同一历史输入换模型重跑（私人台账切换成本核心钩子）。
// 只能重跑自己的运行；走与普通运行相同的护栏(credit/BYOK/频控)。
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })

  const parsed = await readJsonBodyWithLimit(request, MAX_SKILL_RUN_REQUEST_BYTES, '重跑请求体过大', { emptyValue: {} })
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.value
  const model = normalizeRerunModel(body.model)
  if (isValidationError(model)) return Response.json({ error: model.error }, { status: model.status })
  const modelProvider = normalizeOptionalModelProvider(body.modelProvider)
  if (isValidationError(modelProvider)) return Response.json({ error: modelProvider.error }, { status: modelProvider.status })
  const modelVersion = normalizeOptionalModelVersion(body.modelVersion)
  if (isValidationError(modelVersion)) return Response.json({ error: modelVersion.error }, { status: modelVersion.status })

  // 取原运行并校验归属
  const run = await payload.findByID({ collection: 'skill-runs', id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!run) return Response.json({ error: '运行记录不存在' }, { status: 404 })
  const runUserId = typeof (run as any).user === 'object' ? (run as any).user?.id : (run as any).user
  if (String(runUserId) !== String(user.id)) {
    return Response.json({ error: '只能重跑自己的运行' }, { status: 403 })
  }

  // 解析原 Skill + 版本（沿用原运行的版本，保证同版本换模型对比公平）
  const skillId = typeof (run as any).skill === 'object' ? (run as any).skill?.id : (run as any).skill
  const skill = await payload.findByID({ collection: 'skills', id: skillId, depth: 1, overrideAccess: true }).catch(() => null)
  if (!skill) return Response.json({ error: 'Skill 不存在' }, { status: 404 })
  if (!canRerunPrivateLedgerSkill(skill, user)) {
    return Response.json({ error: '该 Skill 当前不可重跑' }, { status: 403 })
  }

  let version: any = (run as any).skillVersion
  if (!version || typeof version === 'string') {
    version = version
      ? await payload
          .findByID({ collection: 'skill-versions', id: version, overrideAccess: true })
          .catch(() => null)
      : await resolveCurrentSkillVersionForPublicEvidence(payload, skill)
  }
  if (!version) return Response.json({ error: '版本不存在' }, { status: 400 })
  if (!isUsableSkillVersionForPublicEvidence(skill, version)) {
    return Response.json({ error: '版本已不可重跑' }, { status: 400 })
  }

  const fullUser = await payload
    .findByID({ collection: 'users', id: user.id, overrideAccess: true, depth: 0 })
    .catch(() => null)
  const userApiKey = decryptSecret((fullUser as any)?.newapiKeyEncrypted) || undefined

  const result = await runSkill({
    payload,
    skill,
    version,
    input: ((run as any).inputJson || {}) as Record<string, unknown>,
    user: { id: user.id as string },
    userApiKey,
    forceModel: model, // 换指定模型
    modelProvider,
    modelVersion,
    rerunOf: String((run as any).id),
    rerunFromModel: (run as any).model ? String((run as any).model) : undefined,
  })

  const status = result.ok
    ? 200
    : result.errorCode === 'INSUFFICIENT_CREDIT'
      ? 402
      : result.errorCode === 'MODEL_REQUIRES_BYOK'
        ? 403
        : result.errorCode === 'PLATFORM_TOKEN_UNAVAILABLE'
          ? 503
          : result.errorCode === 'RATE_LIMITED'
          ? 429
          : 422
  return Response.json(result, { status })
}
