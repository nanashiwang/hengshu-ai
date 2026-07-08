export type SkillVisibility = 'public' | 'private' | 'unlisted' | 'enterprise'
export type PublicSubmissionVisibility = Exclude<SkillVisibility, 'enterprise'>

const PUBLIC_SUBMISSION_VISIBILITIES = new Set(['public', 'private', 'unlisted'])
const PRIVILEGED_ROLES = new Set(['admin', 'reviewer'])

export function isPrivilegedSkillOperator(user: any): boolean {
  return Boolean(user && PRIVILEGED_ROLES.has(String(user.role)))
}

export function normalizeSkillSubmissionVisibility(value: unknown, user?: any): SkillVisibility {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (raw === 'enterprise') return isPrivilegedSkillOperator(user) ? 'enterprise' : 'unlisted'
  return PUBLIC_SUBMISSION_VISIBILITIES.has(raw) ? raw as PublicSubmissionVisibility : 'public'
}

export function normalizeSkillImportVisibility(value: unknown): PublicSubmissionVisibility {
  const raw = typeof value === 'string' ? value.trim() : ''
  return PUBLIC_SUBMISSION_VISIBILITIES.has(raw) ? raw as PublicSubmissionVisibility : 'unlisted'
}
