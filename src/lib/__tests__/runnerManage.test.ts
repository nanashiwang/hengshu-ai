import { describe, expect, it } from 'vitest'
import { canRevokeRunner, newRunnerTokenUpdate, runnerOwnerId } from '@/lib/runnerManage'

describe('runnerManage — Runner 撤销授权', () => {
  it('识别字符串或对象形式的 Runner 归属', () => {
    expect(runnerOwnerId({ user: 'u1' })).toBe('u1')
    expect(runnerOwnerId({ user: { id: 'u2' } })).toBe('u2')
    expect(runnerOwnerId({})).toBeNull()
  })

  it('普通用户只能撤销自己的 Runner', () => {
    expect(canRevokeRunner({ id: 'u1', role: 'user' }, { user: 'u1' })).toBe(true)
    expect(canRevokeRunner({ id: 'u2', role: 'user' }, { user: 'u1' })).toBe(false)
  })

  it('审核员和管理员可代撤销', () => {
    expect(canRevokeRunner({ id: 'r1', role: 'reviewer' }, { user: 'u1' })).toBe(true)
    expect(canRevokeRunner({ id: 'a1', role: 'admin' }, { user: { id: 'u1' } })).toBe(true)
  })

  it('轮换令牌只返回明文一次，落库数据仅包含 hash 和过期时间', () => {
    const next = newRunnerTokenUpdate()
    expect(next.accessToken).toBeTruthy()
    expect(next.data.tokenHash).toHaveLength(64)
    expect(next.data.tokenHash).not.toContain(next.accessToken)
    expect(next.data.token).toBeNull()
    expect(new Date(next.data.tokenExpiresAt).getTime()).toBeGreaterThan(Date.now())
  })
})
