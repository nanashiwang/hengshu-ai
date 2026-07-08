import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { runSkill } from '@/lib/skillRunner'
import { redactGatewayErrorText } from '@/lib/newapi'
import { decryptSecret } from '@/lib/secrets'
import { canUseSkillRunEndpoint } from '@/lib/skillEvidenceAccess'
import { resolveCurrentSkillVersionForPublicEvidence } from '@/lib/skillVersionPublic'
import { readJsonBodyWithLimit } from '@/lib/requestBody'
import {
  isValidationError,
  MAX_SKILL_RUN_REQUEST_BYTES,
  normalizeCompareModels,
  normalizeRunInput,
} from '@/lib/skillRunRequest'

// POST /v1/skills/{slug}/compare —— 多模型对比：同一输入并行跑多个模型
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const payload = await getPayload({ config })

  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })

  const parsed = await readJsonBodyWithLimit(request, MAX_SKILL_RUN_REQUEST_BYTES, '运行请求体过大', { emptyValue: {} })
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.value
  const input = normalizeRunInput(body)
  if (isValidationError(input)) return Response.json({ error: input.error }, { status: input.status })
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : undefined
  const normalizedModels = normalizeCompareModels(body.models)
  if (isValidationError(normalizedModels)) return Response.json({ error: normalizedModels.error }, { status: normalizedModels.status })
  const models = normalizedModels
  if (models.length === 0) {
    return Response.json({ error: '请至少选择一个模型' }, { status: 400 })
  }

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

  const fullUser = await payload
    .findByID({ collection: 'users', id: user.id, overrideAccess: true, depth: 0 })
    .catch(() => null)
  const userApiKey = decryptSecret((fullUser as any)?.newapiKeyEncrypted) || undefined

  // 串行跑各模型（forceModel 固定模型、skipAggregate 不污染聚合指标）。
  // 刻意串行而非并行：让每个 runSkill 看到前一个已扣减的 credit 余额与已落库的频控计数，
  // 消除平台代付下"同一余额被多个并发预检共用"的 TOCTOU 白嫖与频控击穿（对抗审查 P0/P1）。
  const results: any[] = []
  for (const m of models) {
    try {
      const r = await runSkill({
        payload,
        skill,
        version,
        input,
        user: { id: user.id as string },
        userApiKey,
        forceModel: m,
        skipAggregate: true,
        organizationId,
      })
      results.push({ model: m, ...r })
    } catch (e) {
      payload.logger?.error(`模型对比失败 skill=${skill.id} model=${m}: ${redactGatewayErrorText((e as Error).message)}`)
      results.push({ model: m, ok: false, runId: '', errors: ['模型对比失败，请重试或更换模型'] })
    }
  }

  return Response.json({ results })
}
