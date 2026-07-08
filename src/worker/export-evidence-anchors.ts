import 'dotenv/config'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { getPayload } from 'payload'
import config from '@payload-config'
import { canonicalString } from '@/lib/canonical'
import { buildEvidenceAnchorEntry, buildEvidenceAnchorManifest, signEvidenceAnchorManifest } from '@/lib/evidenceAnchor'
import { evidenceSnapshotCoreFromDoc, evidenceSnapshotHash, verifyEvidenceSnapshot } from '@/lib/evidenceSnapshotVerify'
import { getPublicKeyInfo } from '@/lib/signing'
import { isPublicEvidenceSnapshot } from '@/lib/evidenceVerifyPublic'

const OUT = process.env.EVIDENCE_ANCHOR_FILE || 'docs/anchors/evidence-snapshots.jsonl'
const MANIFEST_OUT = process.env.EVIDENCE_ANCHOR_MANIFEST_FILE || 'docs/anchors/evidence-snapshots.manifest.json'

function manifestOptionsFromEnv() {
  const publishedTarget = process.env.EVIDENCE_ANCHOR_PUBLISHED_TO?.trim()
  const publishedUrl = process.env.EVIDENCE_ANCHOR_PUBLISHED_URL?.trim()
  const timestampProvider = process.env.EVIDENCE_ANCHOR_TIMESTAMP_PROVIDER?.trim()
  return {
    publishedTo: publishedTarget
      ? [{ target: publishedTarget, url: publishedUrl || undefined, publishedAt: new Date().toISOString() }]
      : undefined,
    externalTimestamp: timestampProvider
      ? {
          provider: timestampProvider,
          timestamp: process.env.EVIDENCE_ANCHOR_TIMESTAMP_AT?.trim() || new Date().toISOString(),
          receiptUrl: process.env.EVIDENCE_ANCHOR_TIMESTAMP_RECEIPT_URL?.trim() || undefined,
          receiptHash: process.env.EVIDENCE_ANCHOR_TIMESTAMP_RECEIPT_SHA256?.trim() || undefined,
        }
      : undefined,
  }
}

async function main() {
  const payload = await getPayload({ config })
  const publicKey = getPublicKeyInfo()
  const lines: string[] = []
  let page = 1
  let exported = 0
  let previousChainHash: string | null = null

  for (;;) {
    const res = await payload.find({
      collection: 'evidence-snapshots' as any,
      depth: 0,
      limit: 500,
      page,
      overrideAccess: true,
      sort: 'createdAt',
    })

    for (const s of res.docs as any[]) {
      if (!(await isPublicEvidenceSnapshot(payload, s))) continue
      const core = evidenceSnapshotCoreFromDoc(s)
      if (!core) continue
      const verify = verifyEvidenceSnapshot(s, publicKey)
      const entry = buildEvidenceAnchorEntry({
        snapshotId: String(s.id),
        createdAt: s.createdAt,
        ...core,
        payloadHash: s.payloadHash,
        computedHash: evidenceSnapshotHash(core),
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
  const manifest = signEvidenceAnchorManifest(buildEvidenceAnchorManifest(lines, new Date().toISOString(), manifestOptionsFromEnv()))
  await writeFile(manifestPath, `${canonicalString(manifest)}\n`, 'utf8')
  payload.logger.info(`已导出 ${exported} 条证据快照锚点：${OUT}；manifest=${MANIFEST_OUT}`)
  process.exit(0)
}

main().catch((e) => {
  console.error('导出证据快照锚点失败：', e)
  process.exit(1)
})
