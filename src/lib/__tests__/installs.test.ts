import { describe, expect, it } from 'vitest'
import {
  activeInstallMatchesCurrentVersion,
  findActiveInstall,
  installedRecordNeedsRunner,
  isInstallablePublishedSkillVersion,
  resolvePublishedSkill,
} from '@/lib/installs'

describe('installs — 安装记录 Runner 不变量', () => {
  it('installed 状态必须绑定 runner，避免 NULL 绕过复合唯一约束', () => {
    expect(installedRecordNeedsRunner({ status: 'installed', runner: null })).toBe(true)
    expect(installedRecordNeedsRunner({ status: 'installed' })).toBe(true)
    expect(installedRecordNeedsRunner({ status: 'installed', runner: 'r1' })).toBe(false)
    expect(installedRecordNeedsRunner({ status: 'installed', runner: { id: 'r1' } })).toBe(false)
  })

  it('removed 状态允许 runner 为空，便于保留历史或解除引用', () => {
    expect(installedRecordNeedsRunner({ status: 'removed', runner: null })).toBe(false)
    expect(installedRecordNeedsRunner({ runner: null }, { status: 'removed' })).toBe(false)
  })

  it('公开下载/Runner 安装只允许 published+public 且版本未废弃并属于该 Skill', () => {
    const skill = { id: 's1', status: 'published', visibility: 'public' }
    expect(isInstallablePublishedSkillVersion(skill, { id: 'v1', status: 'active', skill: 's1' })).toBe(true)
    expect(isInstallablePublishedSkillVersion(skill, { id: 'v1', status: 'deprecated', skill: 's1' })).toBe(false)
    expect(isInstallablePublishedSkillVersion({ ...skill, visibility: 'private' }, { id: 'v1', status: 'active', skill: 's1' })).toBe(false)
    expect(isInstallablePublishedSkillVersion(skill, { id: 'v1', status: 'active', skill: 's2' })).toBe(false)
    expect(isInstallablePublishedSkillVersion(skill, { id: 'v1', status: 'active' })).toBe(false)
  })

  it('resolvePublishedSkill 拒绝 currentVersion 指向废弃或跨 Skill 版本，避免公开下载旧/错版本 manifest', async () => {
    const payload = {
      find: async () => ({
        docs: [{ id: 's1', slug: 'writer', status: 'published', visibility: 'public', currentVersion: 'v1' }],
      }),
      findByID: async () => ({ id: 'v1', status: 'deprecated', skill: 's1' }),
    }
    await expect(resolvePublishedSkill(payload as any, 'writer')).resolves.toBeNull()

    const crossPayload = {
      find: async () => ({
        docs: [{ id: 's1', slug: 'writer', status: 'published', visibility: 'public', currentVersion: 'v2' }],
      }),
      findByID: async () => ({ id: 'v2', status: 'active', skill: 's2' }),
    }
    await expect(resolvePublishedSkill(crossPayload as any, 'writer')).resolves.toBeNull()
  })

  it('resolvePublishedSkill 没有 currentVersion 时回退到最新 active 版本', async () => {
    const calls: any[] = []
    const payload = {
      find: async (args: any) => {
        calls.push(args)
        if (args.collection === 'skills') {
          return { docs: [{ id: 's1', slug: 'writer', status: 'published', visibility: 'public' }] }
        }
        return { docs: [{ id: 'v-active', status: 'active', skill: 's1', version: '1.0.0' }] }
      },
    }
    await expect(resolvePublishedSkill(payload as any, 'writer')).resolves.toMatchObject({
      skill: { id: 's1' },
      version: { id: 'v-active' },
    })
    expect(calls[1]).toMatchObject({
      collection: 'skill-versions',
      where: { and: [{ skill: { equals: 's1' } }, { status: { equals: 'active' } }] },
    })
  })

  it('findActiveInstall 只承认当前 Runner 的 installed 记录，避免未安装伪造回流', async () => {
    const calls: any[] = []
    const payload = {
      find: async (args: any) => {
        calls.push(args)
        return { docs: [{ id: 'install-1', status: 'installed' }] }
      },
    }

    await expect(findActiveInstall(payload as any, 'u1', 's1', 'r1')).resolves.toMatchObject({ id: 'install-1' })
    expect(calls[0]).toMatchObject({
      collection: 'skill-installs',
      where: {
        and: [
          { user: { equals: 'u1' } },
          { skill: { equals: 's1' } },
          { runner: { equals: 'r1' } },
          { status: { equals: 'installed' } },
        ],
      },
    })

    await expect(findActiveInstall(payload as any, 'u1', 's1', '')).resolves.toBeNull()
  })

  it('Runner 回流必须匹配当前安装版本和 checksum，避免旧版本污染当前兼容证据', () => {
    const version = { id: 'v2', version: '2.0.0' }
    expect(activeInstallMatchesCurrentVersion(
      { status: 'installed', skillVersion: 'v2', installedChecksum: 'sha256:new' },
      version,
      'sha256:new',
    )).toBe(true)
    expect(activeInstallMatchesCurrentVersion(
      { status: 'installed', skillVersion: 'v1', installedChecksum: 'sha256:old' },
      version,
      'sha256:old',
    )).toBe(false)
    expect(activeInstallMatchesCurrentVersion(
      { status: 'installed', skillVersion: 'v2', installedChecksum: 'sha256:new' },
      version,
      'sha256:tampered',
    )).toBe(false)
    expect(activeInstallMatchesCurrentVersion(
      { status: 'removed', skillVersion: 'v2', installedChecksum: 'sha256:new' },
      version,
      'sha256:new',
    )).toBe(false)
    expect(activeInstallMatchesCurrentVersion(
      { status: 'installed', skillVersion: 'v2' },
      version,
      'sha256:new',
    )).toBe(false)
  })
})
