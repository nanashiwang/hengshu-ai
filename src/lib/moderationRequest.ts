export const MAX_MODERATION_REQUEST_BYTES = 50_000
export const MAX_MODERATION_NOTE_LENGTH = 2_000

const REPORT_ACTIONS = ['dismiss', 'resolve', 'ban_target', 'hide_target'] as const
export type ReportAction = (typeof REPORT_ACTIONS)[number]

export type ModerationRequestError = { ok: false; status: 400 | 413; error: string }

export function normalizeReportHandleRequest(body: any): { action: ReportAction; note?: string } | ModerationRequestError {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, error: '请求体必须是 JSON 对象' }
  }
  const action = String(body.action || '').trim()
  if (!(REPORT_ACTIONS as readonly string[]).includes(action)) {
    return { ok: false, status: 400, error: '无效的处置动作' }
  }
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (note.length > MAX_MODERATION_NOTE_LENGTH) return { ok: false, status: 400, error: '处置备注过长' }
  return { action: action as ReportAction, note: note || undefined }
}

export function isModerationRequestError(value: unknown): value is ModerationRequestError {
  return Boolean(value && typeof value === 'object' && (value as any).ok === false)
}
