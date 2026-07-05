export type LoginIdentifierKind = 'email' | 'username'

export function normalizeLoginIdentifier(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function loginIdentifierKind(value: unknown): LoginIdentifierKind {
  return normalizeLoginIdentifier(value).includes('@') ? 'email' : 'username'
}
