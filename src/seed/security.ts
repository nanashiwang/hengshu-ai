import { randomBytes } from 'crypto'

export const DEFAULT_SEED_ADMIN_EMAIL = 'admin@yuanheng.ai'

export function generatedSeedPassword(): string {
  return `hs_${randomBytes(18).toString('base64url')}`
}

export function resolveSeedAdminCredentials(env: Record<string, string | undefined> = process.env): {
  email: string
  password: string
  generated: boolean
} {
  const email = (env.SEED_ADMIN_EMAIL || DEFAULT_SEED_ADMIN_EMAIL).trim()
  const provided = (env.SEED_ADMIN_PASSWORD || '').trim()
  if (provided.length >= 12) return { email, password: provided, generated: false }
  if (env.NODE_ENV === 'production') {
    throw new Error('生产 seed 首管必须显式设置 12 位以上 SEED_ADMIN_PASSWORD，禁止默认弱口令')
  }
  return { email, password: generatedSeedPassword(), generated: true }
}

export function shouldCreateWelcomeInvite(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== 'production' || env.SEED_CREATE_WELCOME_CODE === '1'
}
