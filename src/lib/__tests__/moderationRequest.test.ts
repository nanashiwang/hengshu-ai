import { describe, expect, it } from 'vitest'
import { MAX_MODERATION_NOTE_LENGTH, normalizeReportHandleRequest } from '@/lib/moderationRequest'

describe('moderationRequest — 举报处置请求边界', () => {
  it('归一化合法举报处置请求', () => {
    expect(normalizeReportHandleRequest({ action: ' resolve ', note: ' 已确认 ' })).toEqual({
      action: 'resolve',
      note: '已确认',
    })
    expect(normalizeReportHandleRequest({ action: 'dismiss' })).toEqual({ action: 'dismiss', note: undefined })
  })

  it('拒绝无效 body/action/note', () => {
    expect(normalizeReportHandleRequest([])).toEqual({ ok: false, status: 400, error: '请求体必须是 JSON 对象' })
    expect(normalizeReportHandleRequest({ action: 'delete_all' })).toEqual({ ok: false, status: 400, error: '无效的处置动作' })
    expect(normalizeReportHandleRequest({ action: 'resolve', note: 'x'.repeat(MAX_MODERATION_NOTE_LENGTH + 1) })).toEqual({
      ok: false,
      status: 400,
      error: '处置备注过长',
    })
  })
})
