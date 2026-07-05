import type { Payload } from 'payload'
import { getClientIp, hashIp } from './clientMeta'

export interface AuditEventInput {
  event: string
  actorId?: string | null
  targetUserId?: string | null
  targetType?: string
  targetId?: string
  summary?: string
  metadata?: unknown
  request?: Request
}

const SECRET_KEY_RE = /(key|token|secret|password|credential|authorization|code)$/i
const SECRET_TEXT_RE = /(sk-[A-Za-z0-9/_+\-=]{8,}|Bearer\s+[A-Za-z0-9._~+/\-=]{8,}|enc:v1:[A-Za-z0-9._~+/\-=]+)/g

function truncate(value: string, limit = 500): string {
  return value.length > limit ? `${value.slice(0, limit)}…` : value
}

export function sanitizeAuditMetadata(value: unknown, depth = 0): unknown {
  if (value == null) return value
  if (depth > 4) return '[max-depth]'
  if (typeof value === 'string') return truncate(value.replace(SECRET_TEXT_RE, '<redacted>'))
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitizeAuditMetadata(v, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
      out[k] = SECRET_KEY_RE.test(k) ? '<redacted>' : sanitizeAuditMetadata(v, depth + 1)
    }
    return out
  }
  return String(value)
}

export async function recordAuditEvent(payload: Payload, input: AuditEventInput): Promise<void> {
  try {
    const ip = input.request ? getClientIp(input.request.headers) : ''
    await payload.create({
      collection: 'audit-logs' as any,
      overrideAccess: true,
      data: {
        event: input.event,
        actor: input.actorId || undefined,
        targetUser: input.targetUserId || undefined,
        targetType: input.targetType,
        targetId: input.targetId,
        ipHash: ip ? hashIp(ip) : undefined,
        summary: input.summary ? truncate(input.summary, 1000) : undefined,
        metadata: sanitizeAuditMetadata(input.metadata),
      },
    })
  } catch (e) {
    payload.logger?.error(`审计日志写入失败 event=${input.event}: ${(e as Error).message}`)
  }
}
