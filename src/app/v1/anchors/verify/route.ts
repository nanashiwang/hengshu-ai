import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveRuntimeEnv } from '@/lib/deploymentSettings'
import { readJsonBodyWithLimit } from '@/lib/requestBody'
import { getPublicKeyInfo } from '@/lib/signing'
import {
  MAX_ANCHOR_VERIFY_BYTES,
  parseTrustedAnchorPublishers,
  verifyAnchorManifestBundle,
  type AnchorVerifyKind,
} from '@/lib/anchorVerify'

// POST /v1/anchors/verify —— 公开校验分数/证据外锚 JSONL + manifest（含自签名）。
export async function POST(request: Request) {
  const parsed = await readJsonBodyWithLimit(request, MAX_ANCHOR_VERIFY_BYTES, '外锚校验输入过大')
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.value
  const kind = String(body.kind || '').trim() as AnchorVerifyKind
  if (!['score', 'evidence'].includes(kind)) return Response.json({ error: 'kind 必须是 score 或 evidence' }, { status: 400 })
  if (!body.jsonl || !body.manifest) return Response.json({ error: '缺少 jsonl 或 manifest' }, { status: 400 })

  try {
    const payload = await getPayload({ config })
    const runtimeEnv = await resolveRuntimeEnv(payload)
    const publicKey = getPublicKeyInfo(runtimeEnv)
    const trustedPublishers = Array.isArray(body.trustedPublishers)
      ? body.trustedPublishers
      : parseTrustedAnchorPublishers(runtimeEnv.ANCHOR_TRUSTED_PUBLISHERS || process.env.ANCHOR_TRUSTED_PUBLISHERS)
    const result = verifyAnchorManifestBundle({
      kind,
      jsonl: body.jsonl,
      manifest: body.manifest,
      publicKeyInfo: publicKey,
      trustedPublishers,
      externalTimestampReceipt: body.externalTimestampReceipt,
    })
    return Response.json({ kind, publicKey: publicKey ? { keyId: publicKey.keyId, algorithm: publicKey.algorithm } : null, ...result })
  } catch (e: any) {
    return Response.json({ error: '外锚校验失败' }, { status: 400 })
  }
}
