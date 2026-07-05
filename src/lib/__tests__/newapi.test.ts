import { afterEach, describe, expect, it, vi } from 'vitest'
import { chatCompletion, NewApiError, redactGatewayErrorText } from '@/lib/newapi'

const messages = [{ role: 'user' as const, content: 'hello' }]

describe('newapi — 网关缺失时的 mock/fail-closed', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('开发/测试环境未配置网关时允许 mock，便于本地骨架体验', async () => {
    vi.stubEnv('MODEL_GATEWAY_BASE_URL', '')
    vi.stubEnv('MODEL_GATEWAY_KEY', '')
    const r = await chatCompletion({ model: 'deepseek-chat', messages })
    expect(r.mocked).toBe(true)
    expect(r.text).toContain('[MOCK]')
  })

  it('生产环境未配置网关时 fail-closed，禁止返回模拟输出', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('MODEL_GATEWAY_BASE_URL', '')
    vi.stubEnv('MODEL_GATEWAY_KEY', '')
    await expect(chatCompletion({ model: 'deepseek-chat', messages })).rejects.toMatchObject({
      name: 'NewApiError',
      status: 503,
    } satisfies Partial<NewApiError>)
  })

  it('BYOK 显式传入时只用用户 Key，失败也不回退平台全局 Key', async () => {
    vi.stubEnv('MODEL_GATEWAY_BASE_URL', 'https://gateway.example')
    vi.stubEnv('MODEL_GATEWAY_KEY', 'platform-key')
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response('bad user key', { status: 401 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      chatCompletion({
        model: 'deepseek-chat',
        messages,
        apiKey: 'user-bad-key',
      }),
    ).rejects.toMatchObject({ name: 'NewApiError', status: 401 } satisfies Partial<NewApiError>)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer user-bad-key')
    expect(headers.Authorization).not.toBe('Bearer platform-key')
  })

  it('上游错误体会脱敏，避免把 Key 写入错误日志/台账', async () => {
    vi.stubEnv('MODEL_GATEWAY_BASE_URL', 'https://gateway.example')
    vi.stubEnv('MODEL_GATEWAY_KEY', 'platform-secret-token')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('bad sk-test-redacted and Bearer platform-secret-token and user-secret-token', { status: 401 }),
      ),
    )

    await expect(
      chatCompletion({
        model: 'deepseek-chat',
        messages,
        apiKey: 'user-secret-token',
      }),
    ).rejects.toMatchObject({
      name: 'NewApiError',
      status: 401,
      message: expect.not.stringContaining('user-secret-token'),
    } satisfies Partial<NewApiError>)
  })

  it('redactGatewayErrorText：按模式和额外密钥脱敏', () => {
    vi.stubEnv('MODEL_GATEWAY_KEY', 'platform-secret-token')
    const s = redactGatewayErrorText('sk-test-redacted Bearer platform-secret-token extra-secret', ['extra-secret'])
    expect(s).not.toContain('sk-test-redacted')
    expect(s).not.toContain('platform-secret-token')
    expect(s).not.toContain('extra-secret')
  })
})
