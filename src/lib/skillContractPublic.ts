import { evidenceHash } from './evidenceHash'
import { publicSanitize } from './publicSanitize'
import { skillContractHash } from './skillContract'

function relationId(value: any): string | null {
  if (!value) return null
  return typeof value === 'object' ? String(value.id || '') || null : String(value)
}

export function publicRoutePolicy(routePolicy: any) {
  if (!routePolicy || typeof routePolicy !== 'object' || Array.isArray(routePolicy)) return null
  const { dataDriven: _dataDriven, ...rest } = routePolicy
  return publicSanitize(rest)
}

export function publicSkillContract(version: any) {
  return {
    id: String(version?.id || ''),
    skill: relationId(version?.skill),
    version: version?.version || null,
    contractHash: version?.contractHash || skillContractHash(version),
    contractStatus: version?.contractStatus || 'initial',
    systemPromptHash: evidenceHash(version?.systemPrompt || ''),
    promptTemplateHash: evidenceHash(version?.promptTemplate || ''),
    inputSchema: publicSanitize(version?.inputSchema || null),
    outputSchema: publicSanitize(version?.outputSchema || null),
    recommendedModels: publicSanitize(version?.recommendedModels || null),
    routePolicy: publicRoutePolicy(version?.routePolicy || null),
    permissions: publicSanitize(version?.permissions || null),
    minRunnerVersion: version?.minRunnerVersion || null,
    examplesCount: Array.isArray(version?.examples) ? version.examples.length : 0,
    changelogHash: version?.changelog ? evidenceHash(version.changelog) : null,
    updatedAt: version?.updatedAt || null,
  }
}
