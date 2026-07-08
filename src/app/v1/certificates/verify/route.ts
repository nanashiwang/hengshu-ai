import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveRuntimeEnv } from '@/lib/deploymentSettings'
import { readJsonBodyWithLimit } from '@/lib/requestBody'
import { getPublicKeyInfo } from '@/lib/signing'
import {
  MAX_CERTIFICATE_VERIFY_BYTES,
  normalizeSkillCertificateVerifyRequest,
  verifySkillCertificate,
} from '@/lib/skillCertificateVerify'

// POST /v1/certificates/verify —— 公开校验 Skill 达标证书哈希与 ed25519 签名。
export async function POST(request: Request) {
  const parsed = await readJsonBodyWithLimit(request, MAX_CERTIFICATE_VERIFY_BYTES, '证书验签请求体过大')
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.value
  const normalized = normalizeSkillCertificateVerifyRequest(body)
  if (normalized.error) {
    const status = normalized.error === 'payload_too_large' ? 413 : 400
    return Response.json({ error: normalized.reason || '请求体无效' }, { status })
  }
  if (!normalized.certificate) return Response.json({ error: '缺少 certificate' }, { status: 400 })

  const payload = await getPayload({ config })
  const runtimeEnv = await resolveRuntimeEnv(payload)
  const publicKey = normalized.publicKeyInfo || getPublicKeyInfo(runtimeEnv)
  const result = verifySkillCertificate({
    certificate: normalized.certificate,
    certificateSignature: normalized.certificateSignature,
    publicKeyInfo: publicKey,
  })
  return Response.json({
    publicKey: publicKey ? { keyId: publicKey.keyId, algorithm: publicKey.algorithm } : null,
    ...result,
  })
}
