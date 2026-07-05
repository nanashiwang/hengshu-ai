import { describe, expect, it, vi } from 'vitest'
import {
  collectSkillSubscriberIds,
  notifySkillSubscribers,
  shouldNotifySkillVersionUpdate,
} from '@/lib/skillSubscriberNotifications'

describe('skillSubscriberNotifications — 收藏/安装订阅更新告警', () => {
  it('收藏和安装用户去重，并排除作者/操作者本人', () => {
    const ids = collectSkillSubscriberIds({
      favorites: [{ user: 'u1' }, { user: 'u2' }, { user: 'author' }],
      installs: [
        { user: 'u1', status: 'installed' },
        { user: 'u3', status: 'installed' },
        { user: 'removed-user', status: 'removed' },
        { user: 'unknown-status' },
        { user: 'actor', status: 'installed' },
      ],
      authorId: 'author',
      actorId: 'actor',
    })

    expect(ids.sort()).toEqual(['u1', 'u2', 'u3'])
  })

  it('只在已发布 Skill 切换 currentVersion 时通知', () => {
    expect(
      shouldNotifySkillVersionUpdate({
        operation: 'update',
        doc: { status: 'published', currentVersion: 'v2' },
        previousDoc: { status: 'published', currentVersion: 'v1' },
      }),
    ).toBe(true)

    expect(
      shouldNotifySkillVersionUpdate({
        operation: 'update',
        doc: { status: 'published', currentVersion: 'v1' },
        previousDoc: { status: 'published', currentVersion: 'v1' },
      }),
    ).toBe(false)

    expect(
      shouldNotifySkillVersionUpdate({
        operation: 'update',
        doc: { status: 'published', currentVersion: 'v1' },
        previousDoc: { status: 'pending', currentVersion: 'v1' },
      }),
    ).toBe(false)

    expect(
      shouldNotifySkillVersionUpdate({
        operation: 'create',
        doc: { status: 'published', currentVersion: 'v1' },
      }),
    ).toBe(false)
  })

  it('通知收藏和已安装用户，去重后写入 skill_updated', async () => {
    const created: any[] = []
    const payload = {
      find: vi.fn(async ({ collection }: any) => {
        if (collection === 'favorites') {
          return { docs: [{ user: 'u1' }, { user: 'author' }], totalPages: 1 }
        }
        if (collection === 'skill-installs') {
          return {
            docs: [
              { user: 'u1', status: 'installed' },
              { user: 'u2', status: 'installed' },
              { user: 'old', status: 'removed' },
            ],
            totalPages: 1,
          }
        }
        return { docs: [], totalPages: 1 }
      }),
      create: vi.fn(async ({ data }: any) => {
        created.push(data)
      }),
      logger: { error: vi.fn() },
    }

    await notifySkillSubscribers(payload as any, {
      skill: { id: 's1', title: '演示 Skill', slug: 'demo', author: 'author' },
      version: { id: 'v2', version: '2.0.0' },
      actorId: 'reviewer',
    })

    expect(created.map((n) => n.user).sort()).toEqual(['u1', 'u2'])
    expect(created.every((n) => n.type === 'skill_updated')).toBe(true)
    expect(created[0]).toMatchObject({
      title: '你订阅的 Skill「演示 Skill」有新版本',
      link: '/skills/demo',
      relatedSkill: 's1',
    })
  })
})
