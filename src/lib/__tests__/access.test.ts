import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  adminOrSelf,
  fieldAdminOrSelf,
  isAdmin,
  isCreatorOrAbove,
  isLoggedIn,
  ownerOrAdmin,
  publishedOrPrivileged,
  readableBounty,
  readableReview,
  sensitiveSkillVersionField,
} from '@/access'
import { AuditLogs } from '@/collections/AuditLogs'
import { AdapterProfiles } from '@/collections/AdapterProfiles'
import { CompatTestCases } from '@/collections/CompatTestCases'
import { ContributionLogs } from '@/collections/ContributionLogs'
import { CreditLogs } from '@/collections/CreditLogs'
import { EnterpriseRegistries } from '@/collections/EnterpriseRegistries'
import { EvidenceSnapshots } from '@/collections/EvidenceSnapshots'
import { FailureCases } from '@/collections/FailureCases'
import { ModelProfiles } from '@/collections/ModelProfiles'
import { OrganizationMembers } from '@/collections/OrganizationMembers'
import { Organizations } from '@/collections/Organizations'
import { ScoreSnapshots } from '@/collections/ScoreSnapshots'
import { SkillArtifacts } from '@/collections/SkillArtifacts'
import { SkillPassports } from '@/collections/SkillPassports'
import { SkillRuns } from '@/collections/SkillRuns'
import { Skills } from '@/collections/Skills'
import { SkillVersions } from '@/collections/SkillVersions'
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

  it('Skills 写入 hook 防止普通创作者直接改成企业可见性', () => {
    const beforeChange = Skills.hooks?.beforeChange?.[0] as any
    expect(beforeChange({
      operation: 'update',
      data: { visibility: 'enterprise' },
      req: { user: { id: 'u1', role: 'creator', accountStatus: 'active' } },
    })).toMatchObject({ visibility: 'unlisted' })
    expect(beforeChange({
      operation: 'update',
      data: { visibility: 'enterprise' },
      req: { user: { id: 'admin', role: 'admin', accountStatus: 'active' } },
    })).toMatchObject({ visibility: 'enterprise' })
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

  it('组织成员原始集合：企业管理员只能读取自己负责组织或自己的成员记录', () => {
    const enterpriseAdmin = { id: 'owner-1', role: 'enterprise_admin', accountStatus: 'active' }
    expect(callAccess(OrganizationMembers.access?.read, enterpriseAdmin)).toEqual({
      or: [{ user: { equals: 'owner-1' } }, { 'organization.owner': { equals: 'owner-1' } }],
    })
    expect(callAccess(OrganizationMembers.access?.read, { id: 'u1', role: 'user', accountStatus: 'active' })).toEqual({
      user: { equals: 'u1' },
    })
  })

  it('组织成员写入 hook 阻止企业管理员维护他人组织成员', async () => {
    const beforeValidate = OrganizationMembers.hooks?.beforeValidate?.[0] as any
    const payload = {
      findByID: async ({ id }: any) => ({ id, owner: id === 'org-owned' ? 'owner-1' : 'owner-2' }),
    }
    await expect(beforeValidate({
      data: { organization: 'org-other', user: 'u2' },
      req: { user: { id: 'owner-1', role: 'enterprise_admin', accountStatus: 'active' }, payload },
    })).rejects.toThrow('只能维护自己负责组织的成员')

    await expect(beforeValidate({
      data: { organization: 'org-owned', user: 'u2' },
      req: { user: { id: 'owner-1', role: 'enterprise_admin', accountStatus: 'active' }, payload },
    })).resolves.toMatchObject({ organization: 'org-owned' })
  })

  it('企业 Registry 写入 hook 阻止企业管理员维护他人组织或跨 Skill 锁版本', async () => {
    const beforeValidate = EnterpriseRegistries.hooks?.beforeValidate?.[0] as any
    const payload = {
      findByID: async ({ collection, id }: any) => {
        if (collection === 'organizations') return { id, owner: id === 'org-owned' ? 'owner-1' : 'owner-2' }
        if (collection === 'skill-versions') return { id, skill: id === 'v-owned' ? 'skill-1' : 'skill-2' }
        if (collection === 'skill-passports') return { id, skill: id === 'p-owned' ? 'skill-1' : 'skill-2' }
        return null
      },
    }

    await expect(beforeValidate({
      data: { organization: 'org-other', skill: 'skill-1' },
      req: { user: { id: 'owner-1', role: 'enterprise_admin', accountStatus: 'active' }, payload },
    })).rejects.toThrow('只能维护自己负责组织的注册表')

    await expect(beforeValidate({
      data: { organization: 'org-owned', skill: 'skill-1', skillVersion: 'v-other' },
      req: { user: { id: 'owner-1', role: 'enterprise_admin', accountStatus: 'active' }, payload },
    })).rejects.toThrow('锁定版本不属于该 Skill')

    await expect(beforeValidate({
      data: { organization: 'org-owned', skill: 'skill-1', passport: 'p-other' },
      req: { user: { id: 'owner-1', role: 'enterprise_admin', accountStatus: 'active' }, payload },
    })).rejects.toThrow('Passport 不属于该 Skill')

    await expect(beforeValidate({
      data: { organization: 'org-owned', skill: 'skill-1', skillVersion: 'v-owned', passport: 'p-owned' },
      req: { user: { id: 'owner-1', role: 'enterprise_admin', accountStatus: 'active' }, payload },
    })).resolves.toMatchObject({ organization: 'org-owned' })
  })

  it('Organization 原始集合不向企业管理员直出/直改 identityPolicy，且创建时 owner 只能是本人', () => {
    const enterpriseAdmin = { id: 'owner-1', role: 'enterprise_admin', accountStatus: 'active' }
    const admin = { id: 'admin', role: 'admin', accountStatus: 'active' }
    const field = Organizations.fields.find((f: any) => f.name === 'identityPolicy') as any
    expect(callAccess(field.access?.read, enterpriseAdmin)).toBe(false)
    expect(callAccess(field.access?.update, enterpriseAdmin)).toBe(false)
    expect(callAccess(field.access?.read, admin)).toBe(true)
    expect(callAccess(field.access?.update, admin)).toBe(true)
  })

  it('Organization 创建 hook 阻止企业管理员把 owner 指给他人', () => {
    const beforeChange = Organizations.hooks?.beforeChange?.[0] as any
    expect(() => beforeChange({
      operation: 'create',
      data: { owner: 'other-1' },
      req: { user: { id: 'owner-1', role: 'enterprise_admin', accountStatus: 'active' } },
    })).toThrow('企业管理员只能创建自己负责的组织')

    expect(beforeChange({
      operation: 'create',
      data: {},
      req: { user: { id: 'owner-1', role: 'enterprise_admin', accountStatus: 'active' } },
    })).toMatchObject({ owner: 'owner-1' })
  })

  it('资金/贡献值/审计流水对管理员也只读追加，禁止后台直接增删改破坏台账', () => {
    const admin = { id: 'admin', role: 'admin', accountStatus: 'active' }
    for (const collection of [CreditLogs, ContributionLogs, AuditLogs]) {
      expect(callAccess(collection.access?.create, admin)).toBe(false)
      expect(callAccess(collection.access?.update, admin)).toBe(false)
      expect(callAccess(collection.access?.delete, admin)).toBe(false)
    }
  })

  it('分数快照公开读取只限 public/published Skill，审核角色可读全量排障', () => {
    expect(callAccess(ScoreSnapshots.access?.read, null)).toEqual({
      and: [
        { 'skill.status': { equals: 'published' } },
        { 'skill.visibility': { equals: 'public' } },
      ],
    })
    expect(callAccess(ScoreSnapshots.access?.read, { id: 'r1', role: 'reviewer', accountStatus: 'active' })).toBe(true)
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

  it('SkillRun 原始 IO 和内部网关日志 ID 不对普通用户 REST 读取，只能走审计导出或管理员排障', () => {
    for (const fieldName of ['inputJson', 'outputText', 'outputJson', 'newapiLogId']) {
      const field = SkillRuns.fields.find((f: any) => f.name === fieldName) as any
      expect(callAccess(field.access?.read, { id: 'u1', role: 'user', accountStatus: 'active' })).toBe(false)
      expect(callAccess(field.access?.read, { id: 'admin', role: 'admin', accountStatus: 'active' })).toBe(true)
    }
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

  it('用户删除若存在资金/贡献值流水则阻断，避免级联删除 append-only 台账', async () => {
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
    ).rejects.toThrow('贡献值流水')
  })

  it('原始 Adapter 补丁和黄金样例输入不允许匿名按公开 Skill 直接读取', () => {
    expect(callAccess(AdapterProfiles.access?.read, null)).toBe(false)
    expect(callAccess(CompatTestCases.access?.read, null)).toBe(false)

    const author = { id: 'author-1', role: 'creator', accountStatus: 'active' }
    expect(callAccess(AdapterProfiles.access?.read, author)).toEqual({
      'skill.author': { equals: 'author-1' },
    })
    expect(callAccess(CompatTestCases.access?.read, author)).toEqual({
      'skill.author': { equals: 'author-1' },
    })
  })

  it('黄金样例写入 hook 阻止创作者给他人 Skill 写测试输入或绑定跨 Skill 版本', async () => {
    const beforeValidate = CompatTestCases.hooks?.beforeValidate?.[0] as any
    const payload = {
      findByID: async ({ collection, id }: any) => {
        if (collection === 'skills') return { id, author: id === 'skill-owned' ? 'author-1' : 'author-2' }
        if (collection === 'skill-versions') return { id, skill: id === 'v-owned' ? 'skill-owned' : 'skill-other' }
        return null
      },
    }

    await expect(beforeValidate({
      data: { skill: 'skill-other', inputJson: { topic: 'private' } },
      req: { user: { id: 'author-1', role: 'creator', accountStatus: 'active' }, payload },
    })).rejects.toThrow('无权为他人的 Skill 创建或修改测试样例')

    await expect(beforeValidate({
      data: { skill: 'skill-owned', skillVersion: 'v-other', inputJson: { topic: 'private' } },
      req: { user: { id: 'author-1', role: 'creator', accountStatus: 'active' }, payload },
    })).rejects.toThrow('SkillVersion 不属于该 Skill')

    await expect(beforeValidate({
      data: { skill: 'skill-owned', skillVersion: 'v-owned', inputJson: { topic: 'private' } },
      req: { user: { id: 'author-1', role: 'creator', accountStatus: 'active' }, payload },
    })).resolves.toMatchObject({ skill: 'skill-owned' })
  })

  it('Passport/失败案例/模型画像原始集合不公开，必须走脱敏 /v1 API', () => {
    const admin = { id: 'admin', role: 'admin', accountStatus: 'active' }
    for (const collection of [SkillPassports, FailureCases, ModelProfiles, EvidenceSnapshots, SkillArtifacts]) {
      expect(callAccess(collection.access?.read, null)).toBe(false)
      expect(callAccess(collection.access?.read, admin)).toBe(true)
    }
  })

  it('公开 SkillVersion 可读时仍隐藏 prompt/examples/changelog/routePolicy 原文', () => {
    const anonymousArgs = {
      req: { user: null },
      siblingData: { skill: { author: 'author-1' } },
    } as any
    expect(sensitiveSkillVersionField(anonymousArgs)).toBe(false)

    const authorArgs = {
      req: { user: { id: 'author-1', role: 'creator', accountStatus: 'active' } },
      siblingData: { skill: { author: { id: 'author-1' } } },
    } as any
    expect(sensitiveSkillVersionField(authorArgs)).toBe(true)

    const reviewerArgs = {
      req: { user: { id: 'reviewer-1', role: 'reviewer', accountStatus: 'active' } },
      siblingData: { skill: { author: 'author-1' } },
    } as any
    expect(sensitiveSkillVersionField(reviewerArgs)).toBe(true)

    const routePolicyField = SkillVersions.fields.find((field: any) => field.name === 'routePolicy') as any
    expect(routePolicyField.access.read(anonymousArgs)).toBe(false)
    expect(routePolicyField.access.read(authorArgs)).toBe(true)
    expect(routePolicyField.access.read(reviewerArgs)).toBe(true)
  })

  it('评论和悬赏原始集合不再匿名公开待审/私有记录', () => {
    expect(callAccess(readableReview, null)).toEqual({ status: { equals: 'visible' } })
    expect(callAccess(readableBounty, null)).toEqual({ isPublic: { equals: true } })

    const user = { id: 'u1', role: 'user', accountStatus: 'active' }
    expect(callAccess(readableReview, user)).toEqual({
      or: [{ status: { equals: 'visible' } }, { user: { equals: 'u1' } }],
    })
    expect(callAccess(readableBounty, user)).toEqual({
      or: [
        { isPublic: { equals: true } },
        { creator: { equals: 'u1' } },
        { acceptedBy: { equals: 'u1' } },
      ],
    })

    const reviewer = { id: 'r1', role: 'reviewer', accountStatus: 'active' }
    expect(callAccess(readableReview, reviewer)).toBe(true)
    expect(callAccess(readableBounty, reviewer)).toBe(true)
  })
})
