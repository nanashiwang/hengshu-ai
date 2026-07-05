import { describe, expect, it } from 'vitest'
import { canonicalString } from '@/lib/canonical'
import {
  buildScoreAnchorEntry,
  buildScoreAnchorManifest,
  verifyScoreAnchorLines,
  verifyScoreAnchorManifest,
  type ScoreAnchorBase,
} from '@/lib/scoreAnchor'

const base = (overrides: Partial<ScoreAnchorBase> = {}): ScoreAnchorBase => ({
  snapshotId: 'snap-1',
  createdAt: '2026-07-03T00:00:00.000Z',
  skill: 'skill-1',
  localScore: 90,
  reportCount: 12,
  signedAt: '2026-07-03T00:00:00.000Z',
  payloadHash: 'payload',
  computedHash: 'payload',
  keyId: 'key-1',
  signature: 'sig',
  verifyStatus: 'valid',
  ...overrides,
})

describe('scoreAnchor — 分数快照外锚哈希链', () => {
  it('为每行生成 entryHash 和连续 chainHash', () => {
    const first = buildScoreAnchorEntry(base(), null)
    const second = buildScoreAnchorEntry(base({ snapshotId: 'snap-2', localScore: 91 }), first.chainHash)

    const lines = [canonicalString(first), canonicalString(second)]
    expect(first.previousChainHash).toBeNull()
    expect(second.previousChainHash).toBe(first.chainHash)
    expect(verifyScoreAnchorLines(lines)).toMatchObject({ ok: true, chainHead: second.chainHash })
  })

  it('篡改任意行会破坏 entryHash', () => {
    const entry = buildScoreAnchorEntry(base(), null)
    const tampered = { ...entry, localScore: 99 }
    expect(verifyScoreAnchorLines([canonicalString(tampered)])).toMatchObject({
      ok: false,
      reason: '第 1 行 entryHash 不匹配',
    })
  })

  it('删除中间行会破坏链连续性', () => {
    const first = buildScoreAnchorEntry(base({ snapshotId: 'snap-1' }), null)
    const second = buildScoreAnchorEntry(base({ snapshotId: 'snap-2' }), first.chainHash)
    const third = buildScoreAnchorEntry(base({ snapshotId: 'snap-3' }), second.chainHash)

    expect(verifyScoreAnchorLines([canonicalString(first), canonicalString(third)])).toMatchObject({
      ok: false,
      reason: '第 2 行 previousChainHash 不连续',
    })
  })

  it('manifest 记录行数、链头和文件哈希', () => {
    const first = buildScoreAnchorEntry(base(), null)
    const line = canonicalString(first)
    const manifest = buildScoreAnchorManifest([line], '2026-07-03T00:00:00.000Z')
    expect(manifest).toMatchObject({ version: 1, entries: 1, chainHead: first.chainHash })
    expect(manifest.fileHash).toHaveLength(64)
    expect(verifyScoreAnchorManifest([line], manifest)).toMatchObject({ ok: true })
  })

  it('manifest 文件哈希不一致会被拒绝', () => {
    const first = buildScoreAnchorEntry(base(), null)
    const line = canonicalString(first)
    const manifest = { ...buildScoreAnchorManifest([line], '2026-07-03T00:00:00.000Z'), fileHash: 'bad' }
    expect(verifyScoreAnchorManifest([line], manifest)).toMatchObject({
      ok: false,
      reason: 'manifest fileHash 与 JSONL 文件哈希不一致',
    })
  })
})
