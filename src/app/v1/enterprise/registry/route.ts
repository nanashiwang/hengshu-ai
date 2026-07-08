import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { listEnterprisePolicyTemplates, publicEnterpriseRegistry, upsertEnterpriseRegistry } from '@/lib/enterprise'
import {
  MAX_ENTERPRISE_REQUEST_BYTES,
  requireEnterpriseIds,
  validateEnterpriseStringList,
  validateEnterpriseText,
} from '@/lib/enterpriseRequest'
import { readJsonBodyWithLimit } from '@/lib/requestBody'

// GET /v1/enterprise/registry —— 返回内置企业策略模板。
export async function GET() {
  return Response.json({ templates: listEnterprisePolicyTemplates() })
}

// POST /v1/enterprise/registry —— 企业准入/审批 Skill，可创建或更新 EnterpriseRegistry。
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })

  const parsed = await readJsonBodyWithLimit(request, MAX_ENTERPRISE_REQUEST_BYTES, '企业注册表请求体过大')
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.value

  const ids = requireEnterpriseIds(body, ['organizationId', 'skillId'])
  if (!ids.ok) return Response.json({ error: ids.error }, { status: ids.status })
  for (const check of [
    validateEnterpriseText(body.usageScope, 'usageScope'),
    validateEnterpriseText(body.riskNotes, 'riskNotes'),
    validateEnterpriseStringList(body.modelAllowlist, 'modelAllowlist'),
  ]) {
    if (!check.ok) return Response.json({ error: check.error }, { status: check.status })
  }
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : ''
  const skillId = typeof body.skillId === 'string' ? body.skillId.trim() : ''

  const result = await upsertEnterpriseRegistry(payload, {
    actorId: user.id as string,
    actorRole: (user as any).role,
    organizationId,
    skillId,
    registryId: typeof body.registryId === 'string' ? body.registryId.trim() : undefined,
    skillVersionId: typeof body.skillVersionId === 'string' ? body.skillVersionId.trim() : undefined,
    passportId: typeof body.passportId === 'string' ? body.passportId.trim() : undefined,
    approvalStatus: typeof body.approvalStatus === 'string' ? body.approvalStatus.trim() : undefined,
    modelAllowlist: body.modelAllowlist,
    usageScope: typeof body.usageScope === 'string' ? body.usageScope : undefined,
    riskNotes: typeof body.riskNotes === 'string' ? body.riskNotes : undefined,
    auditPolicy: body.auditPolicy,
    policyTemplate: typeof body.policyTemplate === 'string' ? body.policyTemplate.trim() : undefined,
    enforceCertificateGate: true,
    certificateRiskAccepted: body.certificateRiskAccepted === true,
  })
  if (!result.ok) return Response.json({ error: result.reason }, { status: 403 })

  return Response.json({
    ok: true,
    created: result.created,
    registry: publicEnterpriseRegistry(result.registry),
    certificateSummary: result.certificateSummary,
  })
}
