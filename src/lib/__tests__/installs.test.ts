import { describe, expect, it } from 'vitest'
import { installedRecordNeedsRunner } from '@/lib/installs'

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
})
