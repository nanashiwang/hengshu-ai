import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { encryptSecret } from '@/lib/secrets'
import { recordAuditEvent } from '@/lib/audit'
import { isAccountRequestError, MAX_ACCOUNT_REQUEST_BYTES, normalizeUserSettings } from '@/lib/accountRequest'
import { readJsonBodyWithLimit } from '@/lib/requestBody'

// POST /v1/me/settings —— 用户自助设置。当前支持 BYOK 模型网关 Key。
// { newapiKey?: string }：非空则设置，空串清除。仅改本人。
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })

  const parsed = await readJsonBodyWithLimit(request, MAX_ACCOUNT_REQUEST_BYTES, '用户设置请求体过大', { emptyValue: {} })
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const settings = normalizeUserSettings(parsed.value)
  if (isAccountRequestError(settings)) return Response.json({ error: settings.error }, { status: settings.status })

  const data: Record<string, unknown> = {}
  let byokAction: 'byok_set' | 'byok_cleared' | null = null
  if (Object.prototype.hasOwnProperty.call(settings, 'newapiKey')) {
    const k = settings.newapiKey
    data.newapiKeyEncrypted = k ? encryptSecret(k) : null // 空串清除；非空加密存储
    byokAction = k ? 'byok_set' : 'byok_cleared'
  }
  if (Object.prototype.hasOwnProperty.call(settings, 'bio')) data.bio = settings.bio

  if (Object.keys(data).length === 0) {
    return Response.json({ error: '无可更新字段' }, { status: 400 })
  }

  try {
    await payload.update({ collection: 'users', id: user.id, data, overrideAccess: true })
    if (byokAction) {
      await recordAuditEvent(payload, {
        event: byokAction,
        actorId: user.id as string,
        targetUserId: user.id as string,
        targetType: 'user',
        targetId: user.id as string,
        summary: byokAction === 'byok_set' ? '用户设置 BYOK 模型网关 Key' : '用户清除 BYOK 模型网关 Key',
        request,
      })
    }
    return Response.json({ ok: true })
  } catch (e) {
    payload.logger?.error(`更新用户设置失败: ${(e as Error).message}`)
    return Response.json({ error: '保存失败，请重试' }, { status: 500 })
  }
}
