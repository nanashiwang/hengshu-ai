import { describe, it, expect, afterEach, vi } from 'vitest'
import { createNewApiAdmin, isRealMode, subTokenName, NewApiAdminError } from '@/lib/newapiAdmin'

function realEnv() {
  vi.stubEnv('NEWAPI_ADMIN_BASE_URL', 'https://relay.example.com')
  vi.stubEnv('NEWAPI_ADMIN_KEY', 'access-tok')
  vi.stubEnv('NEWAPI_ADMIN_USER_ID', '1')
  vi.stubEnv('NEWAPI_CREDIT_TO_QUOTA', '700')
}

// 按 new-api 响应形态 mock fetch；tokens 数组模拟平台账号下的令牌
function mockFetch(tokens: any[], calls: any[]) {
  return vi.fn(async (url: string, opts: any) => {
    const method = opts?.method || 'GET'
    const body = opts?.body ? JSON.parse(opts.body) : undefined
    calls.push({ url, method, body, headers: opts?.headers })
    const ok = (data: any) => new Response(JSON.stringify({ success: true, data }), { status: 200 })
    if (url.includes('/api/token/') && method === 'GET') return ok({ items: tokens })
    if (url.includes('/api/token/') && method === 'POST') {
      tokens.push({ id: 5, name: body.name, key: 'sk-new', remain_quota: body.remain_quota })
      return ok(null)
    }
    if (url.includes('/api/token/') && method === 'PUT') return ok(null)
    if (url.includes('/api/log/')) return ok({ items: [{ quota: 1400 }, { quota: 700 }] })
    return ok(null)
  })
}

describe('newapiAdmin — stub 模式', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('未配置 env → stub，方法模拟成功', async () => {
    vi.stubEnv('NEWAPI_ADMIN_BASE_URL', '')
    vi.stubEnv('NEWAPI_ADMIN_KEY', '')
    expect(isRealMode()).toBe(false)
    const a = createNewApiAdmin()
    expect(a.mode).toBe('stub')
    expect(await a.provisionSubToken('u1')).toEqual({ tokenName: 'hs_u1', simulated: true })
  })
  it('子令牌命名 hs_<userId>', () => {
    expect(subTokenName('abc-123')).toBe('hs_abc-123')
  })
})

describe('newapiAdmin — real 模式(new-api 源码规格)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('缺 NEWAPI_ADMIN_USER_ID → 抛 NewApiAdminError', async () => {
    vi.stubEnv('NEWAPI_ADMIN_BASE_URL', 'https://relay.example.com')
    vi.stubEnv('NEWAPI_ADMIN_KEY', 'k')
    vi.stubEnv('NEWAPI_ADMIN_USER_ID', '')
    const a = createNewApiAdmin()
    expect(a.mode).toBe('real')
    await expect(a.adjustQuota('u1', 1)).rejects.toBeInstanceOf(NewApiAdminError)
  })

  it('provisionSubToken：先查名→无则 POST 建 hs_<id>(remain 0/永不过期) + 正确鉴权头', async () => {
    realEnv()
    const tokens: any[] = []
    const calls: any[] = []
    vi.stubGlobal('fetch', mockFetch(tokens, calls))
    const a = createNewApiAdmin()
    const r = await a.provisionSubToken('u1')
    expect(r).toMatchObject({ tokenName: 'hs_u1', key: 'sk-new', tokenId: 5, simulated: false })
    const post = calls.find((c) => c.method === 'POST')
    expect(post.body).toMatchObject({ name: 'hs_u1', remain_quota: 0, expired_time: -1, unlimited_quota: false })
    expect(post.headers.Authorization).toBe('access-tok') // 默认不加 Bearer
    expect(post.headers['New-Api-User']).toBe('1')
  })

  it('adjustQuota：读令牌→remain_quota += delta*CREDIT_TO_QUOTA→PUT(绝对值)', async () => {
    realEnv()
    const tokens = [{ id: 5, name: 'hs_u1', key: 'sk', remain_quota: 100 }]
    const calls: any[] = []
    vi.stubGlobal('fetch', mockFetch(tokens, calls))
    const a = createNewApiAdmin()
    const r = await a.adjustQuota('u1', 2) // 2 credit × 700 = 1400
    expect(r).toMatchObject({ ok: true, remainQuota: 1500, simulated: false }) // 100+1400
    const put = calls.find((c) => c.method === 'PUT')
    expect(put.body.remain_quota).toBe(1500)
    expect(put.body.id).toBe(5) // 传完整对象
  })

  it('adjustQuota：子令牌不存在 → 抛错', async () => {
    realEnv()
    vi.stubGlobal('fetch', mockFetch([], []))
    const a = createNewApiAdmin()
    await expect(a.adjustQuota('u1', 1)).rejects.toBeInstanceOf(NewApiAdminError)
  })

  it('fetchUsage：GET /api/log type=2 聚合 quota→分(quota/CREDIT_TO_QUOTA)', async () => {
    realEnv()
    const calls: any[] = []
    vi.stubGlobal('fetch', mockFetch([], calls))
    const a = createNewApiAdmin()
    const u = await a.fetchUsage('u1', 0)
    expect(u).toMatchObject({ costCents: 3, calls: 2, simulated: false }) // (1400+700)/700=3
    const log = calls.find((c) => c.url.includes('/api/log/'))
    expect(log.url).toContain('type=2')
    expect(log.url).toContain('token_name=hs_u1')
  })

  it('New API 返回 success:false → 抛 NewApiAdminError', async () => {
    realEnv()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ success: false, message: '无权限' }), { status: 200 })),
    )
    const a = createNewApiAdmin()
    await expect(a.provisionSubToken('u1')).rejects.toBeInstanceOf(NewApiAdminError)
  })
})
