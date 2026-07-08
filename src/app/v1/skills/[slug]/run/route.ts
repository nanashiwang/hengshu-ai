import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { runSkill } from '@/lib/skillRunner'
import { decryptSecret } from '@/lib/secrets'
import { canUseSkillRunEndpoint } from '@/lib/skillEvidenceAccess'
import { resolveCurrentSkillVersionForPublicEvidence } from '@/lib/skillVersionPublic'
import { readJsonBodyWithLimit } from '@/lib/requestBody'
import {
  isValidationError,
  MAX_SKILL_RUN_REQUEST_BYTES,
  normalizeOptionalModelProvider,
  normalizeOptionalModelVersion,
  normalizeRouteMode,
  normalizeRunInput,
} from '@/lib/skillRunRequest'

// POST /v1/skills/{slug}/run —— 对外运行端点（产品文档 §3.3）
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const payload = await getPayload({ config })

  // 鉴权
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })

  const parsed = await readJsonBodyWithLimit(request, MAX_SKILL_RUN_REQUEST_BYTES, '运行请求体过大', { emptyValue: {} })
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.value
  const input = normalizeRunInput(body)
  if (isValidationError(input)) return Response.json({ error: input.error }, { status: input.status })
  const routeMode = normalizeRouteMode(body.routeMode)
  if (isValidationError(routeMode)) return Response.json({ error: routeMode.error }, { status: routeMode.status })
  const modelProvider = normalizeOptionalModelProvider(body.modelProvider)
  if (isValidationError(modelProvider)) return Response.json({ error: modelProvider.error }, { status: modelProvider.status })
  const modelVersion = normalizeOptionalModelVersion(body.modelVersion)
  if (isValidationError(modelVersion)) return Response.json({ error: modelVersion.error }, { status: modelVersion.status })
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : undefined

  // 查 Skill 后手动执行公开/企业/作者预览边界；Payload read access 只覆盖公开与作者，不足以表达企业 Registry。
  const skills = await payload.find({
    collection: 'skills',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const skill = skills.docs[0]
  if (!skill) return Response.json({ error: 'Skill 不存在或无权访问' }, { status: 404 })
  const access = canUseSkillRunEndpoint(skill, user, organizationId)
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status })

  const version = await resolveCurrentSkillVersionForPublicEvidence(payload, skill)
  if (!version) return Response.json({ error: 'Skill 暂无可用版本' }, { status: 400 })

  // 用户绑定的 模型网关 Key（可选，优先于全局）
  const fullUser = await payload
    .findByID({ collection: 'users', id: user.id, overrideAccess: true, depth: 0 })
    .catch(() => null)
  const userApiKey = decryptSecret((fullUser as any)?.newapiKeyEncrypted) || undefined

  const result = await runSkill({
    payload,
    skill,
    version,
    input,
    user: { id: user.id as string },
    routeMode,
    modelProvider,
    modelVersion,
    userApiKey,
    organizationId,
  })

  // 护栏错误码 → HTTP 状态（余额不足 402 / 需 BYOK 403 / 频控 429）
  const status = result.ok
    ? 200
    : result.errorCode === 'INSUFFICIENT_CREDIT'
      ? 402
      : result.errorCode === 'MODEL_REQUIRES_BYOK'
        ? 403
        : result.errorCode === 'PLATFORM_TOKEN_UNAVAILABLE'
          ? 503
          : result.errorCode === 'ENTERPRISE_POLICY_DENIED'
          ? 403
          : result.errorCode === 'RATE_LIMITED'
          ? 429
          : 422
  return Response.json(result, { status })
}
