import { publicSanitize } from './publicSanitize'
import { boundedStringParam } from './queryParams'

export function buildModelProfileWhere(params: URLSearchParams) {
  const modelName = boundedStringParam(params, 'modelName', 160)
  const modelVersion = boundedStringParam(params, 'modelVersion', 160)
  const provider = boundedStringParam(params, 'provider', 80)
  const profileStatus = params.get('status')?.trim()
  const and: any[] = [
    profileStatus && ['observed', 'verified', 'stale'].includes(profileStatus)
      ? { profileStatus: { equals: profileStatus } }
      : { profileStatus: { in: ['observed', 'verified', 'stale'] } },
    {
      or: [
        { 'capabilities.observedSamples': { greater_than: 0 } },
        { 'capabilities.effectiveSamples': { greater_than: 0 } },
      ],
    },
  ]
  if (modelName) and.push({ modelName: { equals: modelName } })
  if (modelVersion) and.push({ modelVersion: { equals: modelVersion } })
  if (provider) and.push({ provider: { equals: provider } })
  return { and }
}

export function isPublicModelProfile(profile: any) {
  const status = String(profile?.profileStatus || 'observed')
  const capabilities = profile?.capabilities && typeof profile.capabilities === 'object' ? profile.capabilities : {}
  const observedSamples = Number(capabilities.observedSamples || 0)
  const effectiveSamples = Number(capabilities.effectiveSamples || 0)
  return ['observed', 'verified', 'stale'].includes(status) && (observedSamples > 0 || effectiveSamples > 0)
}

export function publicModelProfile(profile: any) {
  const capabilities = publicSanitize(profile?.capabilities && typeof profile.capabilities === 'object' ? profile.capabilities : {})
  const knownIssues = publicSanitize(profile?.knownIssues && typeof profile.knownIssues === 'object' ? profile.knownIssues : {})
  const modelParams = profile?.modelName
    ? new URLSearchParams({
        modelName: String(profile.modelName),
        ...(profile?.modelVersion ? { modelVersion: String(profile.modelVersion) } : {}),
      }).toString()
    : ''
  return {
    id: String(profile?.id || ''),
    provider: profile?.provider || null,
    modelName: profile?.modelName || null,
    failuresUrl: modelParams ? `/failures?${modelParams}` : null,
    adaptersUrl: modelParams ? `/v1/adapters?${modelParams}` : null,
    modelVersion: profile?.modelVersion || null,
    profileStatus: profile?.profileStatus || 'observed',
    supportsStructuredOutput: Boolean(profile?.supportsStructuredOutput),
    supportsToolUse: Boolean(profile?.supportsToolUse),
    jsonStabilityScore: profile?.jsonStabilityScore ?? null,
    contextLength: profile?.contextLength ?? null,
    region: profile?.region || null,
    knownIssues: {
      lowSamples: Boolean(knownIssues.lowSamples),
      successRate: knownIssues.successRate ?? null,
      formatRate: knownIssues.formatRate ?? null,
      avgLatencyMs: knownIssues.avgLatencyMs ?? null,
    },
    capabilities: {
      observedSamples: capabilities.observedSamples ?? 0,
      effectiveSamples: capabilities.effectiveSamples ?? capabilities.observedSamples ?? 0,
      sourceSummary: Array.isArray(capabilities.sourceSummary) ? capabilities.sourceSummary : [],
    },
    regressionAlerts: publicSanitize(Array.isArray(profile?.regressionAlerts) ? profile.regressionAlerts : []),
    driftSummary: publicSanitize(profile?.driftSummary && typeof profile.driftSummary === 'object' ? profile.driftSummary : null),
    driftHistory: publicSanitize(Array.isArray(profile?.driftHistory) ? profile.driftHistory : []),
    freshness: publicSanitize(profile?.freshness && typeof profile.freshness === 'object' ? profile.freshness : null),
    lastObservedAt: profile?.lastObservedAt || null,
  }
}
