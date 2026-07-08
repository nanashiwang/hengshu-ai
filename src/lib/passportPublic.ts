import { publicSanitize } from './publicSanitize'
import { evidenceVerifyApiUrl, evidenceVerifyPageUrl } from './evidenceLinks'

export function publicSkillPassport(passport: any, benchmarkSummary?: any) {
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
  }
}
