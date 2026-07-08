import { describe, expect, it } from 'vitest'
import {
  certificateVerifyPageUrl,
  evidenceVerifyApiUrl,
  evidenceVerifyPageUrl,
  normalizeCertificateUrl,
} from '@/lib/evidenceLinks'

describe('evidenceLinks — 证据与证书验签链接', () => {
  it('生成证据 API 与页面验签链接', () => {
    expect(evidenceVerifyApiUrl('skill_passport', 'passport 1')).toBe(
      '/v1/evidence/verify?targetType=skill_passport&targetId=passport%201',
    )
    expect(evidenceVerifyPageUrl('failure_case', 'failure-1')).toBe(
      '/verify?targetType=failure_case&targetId=failure-1',
    )
  })

  it('证书页面验签只允许站内 Skill 证书 API，避免任意 URL 自动抓取', () => {
    expect(normalizeCertificateUrl('/v1/skills/writer/certificate')).toBe('/v1/skills/writer/certificate')
    expect(normalizeCertificateUrl('/v1/skills/writer/certificate?unused=1#x')).toBe('/v1/skills/writer/certificate')
    expect(normalizeCertificateUrl('/v1/skills/%E5%86%99%E4%BD%9C/certificate')).toBe('/v1/skills/%E5%86%99%E4%BD%9C/certificate')
    expect(certificateVerifyPageUrl('/v1/skills/writer/certificate')).toBe(
      '/verify?certificateUrl=%2Fv1%2Fskills%2Fwriter%2Fcertificate',
    )
    expect(certificateVerifyPageUrl('https://evil.test/certificate')).toBeNull()
    expect(certificateVerifyPageUrl('//evil.test/v1/skills/writer/certificate')).toBeNull()
    expect(certificateVerifyPageUrl('/v1/skills/writer/passport')).toBeNull()
    expect(certificateVerifyPageUrl('/v1/enterprise/registry/reg-1/passport')).toBeNull()
    expect(certificateVerifyPageUrl('/v1/skills/%2Fsecret/certificate')).toBeNull()
    expect(certificateVerifyPageUrl('/v1/skills/%E0%A4%A/certificate')).toBeNull()
    expect(certificateVerifyPageUrl(`/v1/skills/${'x'.repeat(240)}/certificate`)).toBeNull()
  })
})
