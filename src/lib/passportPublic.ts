import { publicSanitize } from './publicSanitize'
import { certificateVerifyPageUrl, evidenceVerifyApiUrl, evidenceVerifyPageUrl } from './evidenceLinks'

export type PublicSkillPassportOptions = {
  slug?: string | null
}

function passportReviewPlaybook(passport: any, opts: PublicSkillPassportOptions = {}) {
  const slug = opts.slug ? String(opts.slug) : ''
  const trustScore = Number(passport?.trustScore)
  const trusted = Number.isFinite(trustScore) && trustScore >= 80
  const current = passport?.status === 'current'
  const signed = passport?.signatureStatus === 'signed'
  const decision = !current ? 'refresh_or_review' : trusted && signed ? 'accept' : 'review'

  return {
    customerValue:
      '把“这个 Skill 靠不靠谱”拆成可复核步骤：先看 Passport 当前性和可信分，再验签证据/证书，最后用自己的模型试跑或重跑。',
    decision,
    reviewChecklist: [
      'Passport 是否为 current，且 lastVerifiedAt 足够新',
      'trustScore、成功率、格式通过率、失败摘要是否满足你的场景',
      'manifestChecksum、evidenceHash 和证书是否能公开验签',
      '黄金样例与兼容证据是否覆盖你的模型或输入档',
    ],
    nextActions: [
      {
        label: '验签 Passport 证据',
        description: '用 evidenceHash / payloadHash / ed25519 签名确认 Passport 没被篡改。',
        href: evidenceVerifyPageUrl('skill_passport', passport?.id),
      },
      {
        label: '验签达标证书',
        description: '证书会绑定 Contract、Passport、可信兼容运行数和黄金样例，适合采购或企业准入复核。',
        href: slug ? certificateVerifyPageUrl(`/v1/skills/${encodeURIComponent(slug)}/certificate`) : null,
      },
      {
        label: '查看 Contract',
        description: '核对输入/输出 schema、权限、推荐模型和最低 Runner 版本是否符合你的环境。',
        href: slug ? `/v1/skills/${encodeURIComponent(slug)}/contract` : null,
      },
      {
        label: '用自己的模型试跑',
        description: '在线试跑或从私人台账换模型重跑，确认 Passport 结论在你的模型/网关里仍成立。',
        href: slug ? `/skills/${encodeURIComponent(slug)}/run` : null,
      },
    ],
  }
}

export function publicSkillPassport(passport: any, benchmarkSummary?: any, opts: PublicSkillPassportOptions = {}) {
  return {
    id: String(passport?.id || ''),
    status: passport?.status || null,
    skillClass: passport?.skillClass || null,
    trustScore: passport?.trustScore ?? null,
    signatureStatus: passport?.signatureStatus || null,
    manifestChecksum: passport?.manifestChecksum || null,
    capabilitySummary: publicSanitize(passport?.capabilitySummary || null),
    compatibilitySummary: publicSanitize(passport?.compatibilitySummary || null),
    reliabilitySummary: publicSanitize(passport?.reliabilitySummary || null),
    safetySummary: publicSanitize(passport?.safetySummary || null),
    failureSummary: publicSanitize(passport?.failureSummary || null),
    evidenceSummary: publicSanitize(passport?.evidenceSummary || null),
    evidenceHash: passport?.evidenceHash || null,
    enterpriseSummary: publicSanitize(passport?.enterpriseSummary || null),
    benchmarkSummary: publicSanitize(benchmarkSummary ?? null),
    evidenceVerifyUrl: evidenceVerifyApiUrl('skill_passport', passport?.id),
    evidenceVerifyPageUrl: evidenceVerifyPageUrl('skill_passport', passport?.id),
    lastVerifiedAt: passport?.lastVerifiedAt || null,
    playbook: passportReviewPlaybook(passport, opts),
  }
}
