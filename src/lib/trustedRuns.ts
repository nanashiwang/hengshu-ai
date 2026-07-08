export function trustedCompatibleRunWhere(userId?: string, filters: { skillId?: string; versionId?: string } = {}) {
  const and: any[] = [
    { success: { equals: true } },
    { formatValid: { equals: true } },
    { countedInMetrics: { not_equals: false } },
    { modelProfile: { exists: true } },
    { skillVersion: { exists: true } },
    { 'skillVersion.status': { not_equals: 'deprecated' } },
    { 'skill.status': { equals: 'published' } },
    { 'skill.visibility': { equals: 'public' } },
  ]
  if (filters.skillId) and.unshift({ skill: { equals: filters.skillId } })
  if (filters.versionId) and.unshift({ skillVersion: { equals: filters.versionId } })
  if (userId) and.unshift({ user: { equals: userId } })
  return { and }
}

export function isTrustedCompatibleRun(run: any) {
  const skill = run?.skill && typeof run.skill === 'object' ? run.skill : null
  const version = run?.skillVersion && typeof run.skillVersion === 'object' ? run.skillVersion : null
  return Boolean(
    run?.success === true &&
      run?.formatValid === true &&
      run?.countedInMetrics !== false &&
      run?.modelProfile &&
      version &&
      version.status !== 'deprecated' &&
      skill?.status === 'published' &&
      skill?.visibility === 'public',
  )
}
