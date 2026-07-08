import { getPayload } from 'payload'
import config from '@payload-config'
import { runnerFromBearer } from '@/lib/runnerAuth'
import { ensureArtifact } from '@/lib/artifacts'
import { resolvePublishedSkill } from '@/lib/installs'
import { readJsonBodyWithLimit } from '@/lib/requestBody'
import { isRunnerCommandError, MAX_RUNNER_COMMAND_REQUEST_BYTES, normalizeRunnerCheckItems } from '@/lib/runnerCommandRequest'

// POST /v1/runner/check  { items: [{slug, checksum}] }  (Bearer)
// 比对各 Skill 当前 checksum，返回是否有更新（不计下载数）
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const actor = await runnerFromBearer(payload, request)
  if (!actor) return Response.json({ error: '未登录或令牌无效' }, { status: 401 })

  const parsed = await readJsonBodyWithLimit(request, MAX_RUNNER_COMMAND_REQUEST_BYTES, 'Runner 检查请求体过大', { emptyValue: {} })
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const items = normalizeRunnerCheckItems(parsed.value?.items)
  if (isRunnerCommandError(items)) return Response.json({ error: items.error }, { status: items.status })

  const updates = []
  for (const it of items) {
    const resolved = await resolvePublishedSkill(payload, it.slug)
    if (!resolved) {
      updates.push({ slug: it.slug, available: false })
      continue
    }
    const artifact = await ensureArtifact(payload, resolved.skill, resolved.version, 'yaml')
    updates.push({
      slug: it.slug,
      available: true,
      version: resolved.version.version,
      checksum: artifact?.checksum,
      outdated: !!artifact?.checksum && it.checksum !== artifact.checksum,
    })
  }

  return Response.json({ updates })
}
