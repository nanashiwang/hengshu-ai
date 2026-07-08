import 'dotenv/config'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { getPayload } from 'payload'
import config from '@payload-config'
import { canonicalString } from '@/lib/canonical'
import { buildScoreAnchorEntry, buildScoreAnchorManifest, signScoreAnchorManifest } from '@/lib/scoreAnchor'
import { scoreSnapshotCore, scoreSnapshotHash, verifyScoreSnapshot } from '@/lib/scoreSnapshotVerify'
import { getPublicKeyInfo } from '@/lib/signing'
import { isPublicScoreSnapshot, publicScoreSnapshotWhere } from '@/lib/scoreSnapshotPublic'

const OUT = process.env.SCORE_ANCHOR_FILE || 'docs/anchors/score-snapshots.jsonl'
const MANIFEST_OUT = process.env.SCORE_ANCHOR_MANIFEST_FILE || 'docs/anchors/score-snapshots.manifest.json'

async function main() {
  const payload = await getPayload({ config })
  const publicKey = getPublicKeyInfo()
  const lines: string[] = []
  let page = 1
  let exported = 0
  let previousChainHash: string | null = null

  for (;;) {
    const res = await payload.find({
      collection: 'score-snapshots',
      where: publicScoreSnapshotWhere(),
      depth: 1,
      limit: 500,
      page,
      overrideAccess: true,
      sort: 'createdAt',
    })

    for (const s of (res.docs as any[]).filter(isPublicScoreSnapshot)) {
      const core = scoreSnapshotCore(s)
      if (!core) continue
      const verify = verifyScoreSnapshot(s, publicKey)
      const entry = buildScoreAnchorEntry({
        snapshotId: String(s.id),
        createdAt: s.createdAt,
        ...core,
        payloadHash: s.payloadHash,
        computedHash: scoreSnapshotHash(core),
        keyId: s.keyId || null,
        signature: s.signature || null,
        verifyStatus: verify.status,
      }, previousChainHash)
      previousChainHash = entry.chainHash
      lines.push(canonicalString(entry))
      exported++
    }

    if (!res.hasNextPage) break
    page++
  }

  const outPath = path.resolve(process.cwd(), OUT)
  const manifestPath = path.resolve(process.cwd(), MANIFEST_OUT)
  await mkdir(path.dirname(outPath), { recursive: true })
  await mkdir(path.dirname(manifestPath), { recursive: true })
  await writeFile(outPath, lines.length ? `${lines.join('\n')}\n` : '', 'utf8')
  const manifest = signScoreAnchorManifest(buildScoreAnchorManifest(lines, new Date().toISOString()))
  await writeFile(manifestPath, `${canonicalString(manifest)}\n`, 'utf8')
  payload.logger.info(`已导出 ${exported} 条分数快照锚点：${OUT}；manifest=${MANIFEST_OUT}`)
  process.exit(0)
}

main().catch((e) => {
  console.error('导出分数快照锚点失败：', e)
  process.exit(1)
})
