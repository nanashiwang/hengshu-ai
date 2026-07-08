import { describe, expect, it } from 'vitest'
import {
  MAX_AUTH_IDENTIFIER_LENGTH,
  MAX_AUTH_PASSWORD_LENGTH,
  MAX_AUTH_REQUEST_BYTES,
  normalizeLoginBody,
  normalizeRegisterBody,
  readAuthJsonBody,
} from '@/lib/authRequest'

function jsonRequest(body: string, headers: Record<string, string> = {}) {
  return new Request('http://local.test', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  })
}

describe('authRequest — 登录注册请求边界', () => {
  it('读取 JSON 前限制认证请求体大小', async () => {
    await expect(readAuthJsonBody(jsonRequest('{"ok":true}', { 'content-length': String(MAX_AUTH_REQUEST_BYTES + 1) }))).resolves.toEqual({
      ok: false,
      status: 413,
      error: '认证请求体过大',
    })
  })

  it('登录请求只保留 identifier/password 并限制长度', () => {
    expect(normalizeLoginBody({ identifier: ' alice ', password: 'secret', role: 'admin' })).toEqual({
      ok: true,
      body: { identifier: 'alice', password: 'secret' },
    })
    expect(normalizeLoginBody({ identifier: 'x'.repeat(MAX_AUTH_IDENTIFIER_LENGTH + 1), password: 'secret' })).toEqual({
      ok: false,
      status: 400,
      error: 'identifier 过长',
    })
    expect(normalizeLoginBody({ identifier: 'alice', password: 'x'.repeat(MAX_AUTH_PASSWORD_LENGTH + 1) })).toEqual({
      ok: false,
      status: 400,
      error: 'password 过长',
    })
  })

  it('注册请求白名单化字段并限制长度', () => {
    expect(normalizeRegisterBody({
      email: ' a@example.com ',
      username: ' nana ',
      password: 'password123',
      inviteCode: ' code ',
      deviceId: ' dev ',
      role: 'admin',
    })).toEqual({
      ok: true,
      body: {
        email: 'a@example.com',
        username: 'nana',
        password: 'password123',
        inviteCode: 'code',
        deviceId: 'dev',
      },
    })
    expect(normalizeRegisterBody({ email: 'x'.repeat(MAX_AUTH_IDENTIFIER_LENGTH + 1) })).toEqual({
      ok: false,
      status: 400,
      error: 'email 过长',
    })
  })
})
