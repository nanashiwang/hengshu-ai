import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  adminOrSelf,
  fieldAdminOrSelf,
  isAdmin,
  isCreatorOrAbove,
  isLoggedIn,
  ownerOrAdmin,
  publishedOrPrivileged,
} from '@/access'
import { AuditLogs } from '@/collections/AuditLogs'
import { ContributionLogs } from '@/collections/ContributionLogs'
import { CreditLogs } from '@/collections/CreditLogs'
import { Skills } from '@/collections/Skills'
import { Users } from '@/collections/Users'
import { decryptSecret } from '@/lib/secrets'

const callAccess = (fn: any, user: any, extra: Record<string, unknown> = {}) =>
  fn({ req: { user }, ...extra } as any)

describe('access — banned active session fail-closed', () => {
  afterEach(() => vi.unstubAllEnvs())

  const banned = { id: 'u1', role: 'admin', accountStatus: 'banned' }

  it('登录/管理/创作者级写权限均拒绝封禁用户', () => {
    expect(callAccess(isLoggedIn, banned)).toBe(false)
    expect(callAccess(isAdmin, banned)).toBe(false)
    expect(callAccess(isCreatorOrAbove, banned)).toBe(false)
  })

  it('owner/admin 访问和敏感字段访问均拒绝封禁用户', () => {
    expect(callAccess(adminOrSelf, banned)).toBe(false)
    expect(callAccess(ownerOrAdmin('user'), banned)).toBe(false)
    expect(fieldAdminOrSelf({ req: { user: banned }, id: 'u1' } as any)).toBe(false)
  })

  it('私有 Skill 读取把封禁用户降级为匿名，只返回公开已发布条件', () => {
    expect(callAccess(publishedOrPrivileged, banned)).toEqual({
      and: [{ status: { equals: 'published' } }, { visibility: { equals: 'public' } }],
    })
  })

  it('Skills 自定义 update access 也拒绝封禁作者', () => {
    expect(callAccess(Skills.access?.update, { id: 'u1', role: 'creator', accountStatus: 'banned' })).toBe(false)
  })

  it('Payload 后台入口也拒绝封禁的管理员/审核员 active session', () => {
    expect(callAccess(Users.access?.admin, { id: 'u1', role: 'admin', accountStatus: 'banned' })).toBe(false)
    expect(callAccess(Users.access?.admin, { id: 'u2', role: 'reviewer', accountStatus: 'banned' })).toBe(false)
  })

  it('正常用户仍保留原访问范围', () => {
    const user = { id: 'u1', role: 'creator', accountStatus: 'active' }
    expect(callAccess(isLoggedIn, user)).toBe(true)
    expect(callAccess(isCreatorOrAbove, user)).toBe(true)
    expect(callAccess(ownerOrAdmin('user'), user)).toEqual({ user: { equals: 'u1' } })
  })

  it('资金/术值/审计流水对管理员也只读追加，禁止后台直接增删改破坏台账', () => {
    const admin = { id: 'admin', role: 'admin', accountStatus: 'active' }
    for (const collection of [CreditLogs, ContributionLogs, AuditLogs]) {
      expect(callAccess(collection.access?.create, admin)).toBe(false)
      expect(callAccess(collection.access?.update, admin)).toBe(false)
      expect(callAccess(collection.access?.delete, admin)).toBe(false)
    }
  })

  it('用户余额快照字段对管理员也不可直接创建/修改，只能由台账/对账 worker 写入', () => {
    const admin = { id: 'admin', role: 'admin', accountStatus: 'active' }
    for (const fieldName of ['creditBalance', 'contributionScore', 'consumptionScore']) {
      const field = Users.fields.find((f: any) => f.name === fieldName) as any
      expect(callAccess(field.access?.create, admin)).toBe(false)
      expect(callAccess(field.access?.update, admin)).toBe(false)
    }
  })

  it('BYOK 密文字段禁止后台/REST 直接读写，避免绕过 settings route', () => {
    const admin = { id: 'admin', role: 'admin', accountStatus: 'active' }
    const field = Users.fields.find((f: any) => f.name === 'newapiKeyEncrypted') as any
    expect(callAccess(field.access?.read, admin, { id: 'admin' })).toBe(false)
    expect(callAccess(field.access?.create, admin)).toBe(false)
    expect(callAccess(field.access?.update, admin, { id: 'admin' })).toBe(false)
  })

  it('服务端 override 写入 BYOK 字段时仍统一加密，防明文落库', async () => {
    vi.stubEnv('PAYLOAD_SECRET', 'test-secret-32-bytes-long-enough')
    const beforeChange = Users.hooks?.beforeChange?.[0] as any
    const data = { newapiKeyEncrypted: 'sk-direct-write' }
    const result = await beforeChange({
      operation: 'update',
      data,
      req: { payload: { count: async () => ({ totalDocs: 1 }) } },
    })
    expect(result.newapiKeyEncrypted).toMatch(/^enc:v1:/)
    expect(result.newapiKeyEncrypted).not.toContain('sk-direct-write')
    expect(decryptSecret(result.newapiKeyEncrypted)).toBe('sk-direct-write')
  })

  it('用户删除若存在资金/术值流水则阻断，避免级联删除 append-only 台账', async () => {
    const beforeDelete = Users.hooks?.beforeDelete?.[0] as any
    const payloadFor = (creditLogs: number, contributionLogs: number) => ({
      count: async ({ collection }: any) => {
        if (collection === 'credit-logs') return { totalDocs: creditLogs }
        if (collection === 'contribution-logs') return { totalDocs: contributionLogs }
        return { totalDocs: 0 }
      },
      findByID: async () => ({ id: 'u1', creditBalance: 0 }),
      delete: async () => undefined,
      update: async () => undefined,
    })

    await expect(
      beforeDelete({ id: 'u1', req: { payload: payloadFor(1, 0) } }),
    ).rejects.toThrow('credit 流水')
    await expect(
      beforeDelete({ id: 'u1', req: { payload: payloadFor(0, 1) } }),
    ).rejects.toThrow('术值流水')
  })
})
