import { describe, expect, it } from 'vitest'
import { readJsonBodyWithLimit } from '@/lib/requestBody'

function jsonRequest(body: string, headers: Record<string, string> = {}) {
  return new Request('http://local.test', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  })
}

describe('readJsonBodyWithLimit', () => {
  it('解析未超限 JSON 请求体', async () => {
    const result = await readJsonBodyWithLimit(jsonRequest('{"ok":true}'), 100)
    expect(result).toEqual({ ok: true, value: { ok: true } })
  })

  it('先用 content-length 拒绝明显超限请求', async () => {
    const result = await readJsonBodyWithLimit(jsonRequest('{"ok":true}', { 'content-length': '101' }), 100, '太大')
    expect(result).toEqual({ ok: false, status: 413, error: '太大' })
  })

  it('按真实 UTF-8 字节数拒绝超限请求', async () => {
    const result = await readJsonBodyWithLimit(jsonRequest(JSON.stringify({ text: '好'.repeat(40) })), 100, '太大')
    expect(result).toEqual({ ok: false, status: 413, error: '太大' })
  })

  it('无效 JSON 返回 400', async () => {
    const result = await readJsonBodyWithLimit(jsonRequest('{bad'), 100)
    expect(result).toEqual({ ok: false, status: 400, error: '请求体无效' })
  })

  it('需要兼容空 body 的运行类接口可指定 emptyValue', async () => {
    const result = await readJsonBodyWithLimit(jsonRequest(''), 100, '太大', { emptyValue: {} })
    expect(result).toEqual({ ok: true, value: {} })
  })
})
