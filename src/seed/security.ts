export function shouldCreateWelcomeInvite(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== 'production' || env.SEED_CREATE_WELCOME_CODE === '1'
}
