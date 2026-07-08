import type { ArtifactFormat } from './artifacts'

export function normalizeManifestFormat(value: unknown): ArtifactFormat {
  return String(value || 'yaml').trim().toLowerCase() === 'json' ? 'json' : 'yaml'
}
