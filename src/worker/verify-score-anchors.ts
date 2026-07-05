import 'dotenv/config'
import { readFile } from 'fs/promises'
import path from 'path'
import { verifyScoreAnchorManifest, type ScoreAnchorManifest } from '@/lib/scoreAnchor'

const IN = process.env.SCORE_ANCHOR_FILE || 'docs/anchors/score-snapshots.jsonl'
const MANIFEST_IN = process.env.SCORE_ANCHOR_MANIFEST_FILE || 'docs/anchors/score-snapshots.manifest.json'

async function main() {
  const anchorPath = path.resolve(process.cwd(), IN)
  const manifestPath = path.resolve(process.cwd(), MANIFEST_IN)
  const lines = (await readFile(anchorPath, 'utf8'))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ScoreAnchorManifest
  const result = verifyScoreAnchorManifest(lines, manifest)
  if (!result.ok) {
    console.error(`分数快照外锚校验失败：${result.reason}`)
    process.exit(2)
  }
  console.log(`分数快照外锚校验通过：entries=${manifest.entries} chainHead=${result.chainHead || 'null'}`)
  process.exit(0)
}

main().catch((e) => {
  console.error('分数快照外锚校验失败：', e)
  process.exit(1)
})
