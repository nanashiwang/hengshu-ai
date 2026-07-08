import { getPayload } from 'payload'
import config from '@payload-config'
import { runnerFromBearer } from '@/lib/runnerAuth'
import { findInstall, resolvePublishedSkill } from '@/lib/installs'
import { readJsonBodyWithLimit } from '@/lib/requestBody'
import { isRunnerCommandError, MAX_RUNNER_COMMAND_REQUEST_BYTES, normalizeRunnerSlug } from '@/lib/runnerCommandRequest'

// POST /v1/runner/touch  { slug }  (Bearer) —— 运行后刷新安装记录的 lastUsedAt（活跃安装）
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const actor = await runnerFromBearer(payload, request)
  if (!actor) return Response.json({ error: '未登录或令牌无效' }, { status: 401 })

  const parsed = await readJsonBodyWithLimit(request, MAX_RUNNER_COMMAND_REQUEST_BYTES, 'Runner touch 请求体过大', { emptyValue: {} })
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const slug = normalizeRunnerSlug(parsed.value?.slug)
  if (isRunnerCommandError(slug)) return Response.json({ error: slug.error }, { status: slug.status })
  const resolved = await resolvePublishedSkill(payload, slug)
  if (!resolved) return Response.json({ ok: true })

  const install = await findInstall(payload, actor.user.id, resolved.skill.id, actor.runner.id)
  if (install) {
    await payload.update({
      collection: 'skill-installs',
      id: install.id,
      data: { lastUsedAt: new Date().toISOString() },
      overrideAccess: true,
    })
  }
  return Response.json({ ok: true })
}
