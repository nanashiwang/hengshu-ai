import { getPayload } from 'payload'
import config from '@payload-config'
import { runnerFromBearer } from '@/lib/runnerAuth'
import { findInstall, resolvePublishedSkill } from '@/lib/installs'
import { readJsonBodyWithLimit } from '@/lib/requestBody'
import { isRunnerCommandError, MAX_RUNNER_COMMAND_REQUEST_BYTES, normalizeRunnerSlug } from '@/lib/runnerCommandRequest'

// POST /v1/runner/uninstall  { slug }  (Bearer) —— 标记安装为已移除
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const actor = await runnerFromBearer(payload, request)
  if (!actor) return Response.json({ error: '未登录或令牌无效' }, { status: 401 })

  const parsed = await readJsonBodyWithLimit(request, MAX_RUNNER_COMMAND_REQUEST_BYTES, 'Runner 卸载请求体过大', { emptyValue: {} })
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const slug = normalizeRunnerSlug(parsed.value?.slug)
  if (isRunnerCommandError(slug)) return Response.json({ error: slug.error }, { status: slug.status })
  const resolved = await resolvePublishedSkill(payload, slug)
  if (!resolved) return Response.json({ ok: true }) // 容忍：本地删了即可

  const install = await findInstall(payload, actor.user.id, resolved.skill.id, actor.runner.id)
  if (install) {
    await payload.update({
      collection: 'skill-installs',
      id: install.id,
      data: { status: 'removed' },
      overrideAccess: true,
    })
  }
  return Response.json({ ok: true })
}
