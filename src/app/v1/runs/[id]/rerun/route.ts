import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { decryptSecret } from '@/lib/secrets'
import { readJsonBodyWithLimit } from '@/lib/requestBody'
import { rerunPrivateLedgerRun } from '@/lib/privateRunRerun'
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

  const fullUser = await payload
    .findByID({ collection: 'users', id: user.id, overrideAccess: true, depth: 0 })
    .catch(() => null)
  const userApiKey = decryptSecret((fullUser as any)?.newapiKeyEncrypted) || undefined

  const rerun = await rerunPrivateLedgerRun(payload, {
    user: user as any,
    sourceRunId: id,
    model,
    modelProvider,
    modelVersion,
    userApiKey,
  })

  return Response.json(rerun.body, { status: rerun.status })
}
