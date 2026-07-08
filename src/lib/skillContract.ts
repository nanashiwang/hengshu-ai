import { evidenceHash } from './evidenceHash'

const CONTRACT_FIELDS = [
  'systemPrompt',
  'promptTemplate',
  'inputSchema',
  'outputSchema',
  'recommendedModels',
  'routePolicy',
  'permissions',
  'minRunnerVersion',
] as const

export function skillContractCore(version: any) {
  return CONTRACT_FIELDS.reduce((acc: Record<string, unknown>, key) => {
    acc[key] = version?.[key] ?? null
    return acc
  }, {})
}

export function skillContractHash(version: any): string {
  return evidenceHash(skillContractCore(version))
}

export function isBreakingContractChange(previous: any, next: any): boolean {
  if (!previous) return false
  const prevInput = evidenceHash(previous.inputSchema || null)
  const nextInput = evidenceHash(next.inputSchema || null)
  const prevOutput = evidenceHash(previous.outputSchema || null)
  const nextOutput = evidenceHash(next.outputSchema || null)
  const prevPerm = evidenceHash(previous.permissions || null)
  const nextPerm = evidenceHash(next.permissions || null)
  const runnerChanged = String(previous.minRunnerVersion || '') !== String(next.minRunnerVersion || '')
  return prevInput !== nextInput || prevOutput !== nextOutput || prevPerm !== nextPerm || runnerChanged
}

export function contractStatusFor(previous: any, next: any): 'initial' | 'compatible_change' | 'breaking_change' {
  if (!previous?.contractHash) return 'initial'
  if (isBreakingContractChange(previous, next)) return 'breaking_change'
  return previous.contractHash === skillContractHash(next) ? 'compatible_change' : 'compatible_change'
}
