import { randomToken, runnerTokenExpiresAt, runnerTokenHash } from './runnerAuth'

export const RUNNER_REVOKE_STAFF_ROLES = new Set(['admin', 'reviewer'])

export function runnerOwnerId(runner: any): string | null {
  const owner = runner?.user
  const id = typeof owner === 'object' ? owner?.id : owner
  return id ? String(id) : null
}

export function canRevokeRunner(user: any, runner: any): boolean {
  if (!user || !runner) return false
  if (RUNNER_REVOKE_STAFF_ROLES.has(String(user.role || ''))) return true
  const ownerId = runnerOwnerId(runner)
  return !!ownerId && String(user.id) === ownerId
}

export function newRunnerTokenUpdate(bytes = 48): {
  accessToken: string
  data: { tokenHash: string; tokenExpiresAt: string; token: null }
} {
  const accessToken = randomToken(bytes)
  return {
    accessToken,
    data: {
      tokenHash: runnerTokenHash(accessToken),
      tokenExpiresAt: runnerTokenExpiresAt(),
      token: null,
    },
  }
}
