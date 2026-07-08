import { createHash } from 'crypto'
import { normalizeSkillImportVisibility, type PublicSubmissionVisibility } from './skillVisibility'

export type SkillImportSourceFormat = 'package' | 'github_readme' | 'claude_skill' | 'gpts'

export interface SkillImportSourceInput {
  title?: string
  description?: string
  categorySlug?: string
  visibility?: PublicSubmissionVisibility | 'enterprise'
  format?: SkillImportSourceFormat
  url?: string
  path?: string
  fileName?: string
  content?: string
  idempotencyKey?: string
}

export interface NormalizedSkillImportSource extends SkillImportSourceInput {
  title: string
  visibility: PublicSubmissionVisibility
  format: SkillImportSourceFormat
  idempotencyKey: string
  locator: string
}

function safeTitle(value: string) {
  const trimmed = value.trim().replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ')
  return trimmed.slice(0, 80) || 'Imported Skill'
}

function titleFromLocator(source: SkillImportSourceInput) {
  const raw = source.url || source.path || source.fileName || 'Imported Skill'
  const last = raw.split(/[?#]/)[0].split(/[\\/]/).filter(Boolean).pop() || raw
  return safeTitle(last.replace(/\.(zip|tgz|tar\.gz|md|json|ya?ml)$/i, '').replace(/[-_]+/g, ' '))
}

function inferFormat(source: SkillImportSourceInput): SkillImportSourceFormat {
  if (source.format) return source.format
  const name = `${source.fileName || ''} ${source.url || ''} ${source.path || ''}`.toLowerCase()
  if (/skill\.md(\?|#|$)/.test(name)) return 'claude_skill'
  if (/(gpts?|gpt-config|actions)\.(json|ya?ml)(\?|#|$)/.test(name)) return 'gpts'
  if (/\.(zip|tgz|tar\.gz)(\?|#|$)/.test(name)) return 'package'
  return 'github_readme'
}

export function normalizeSkillImportSource(source: SkillImportSourceInput, index = 0): NormalizedSkillImportSource {
  const format = inferFormat(source)
  const locator = source.url || source.path || source.fileName || `inline:${index}`
  const digest = createHash('sha256').update(`${format}:${locator}`).digest('hex').slice(0, 24)
  const visibility = normalizeSkillImportVisibility(source.visibility)
  return {
    ...source,
    title: safeTitle(source.title || titleFromLocator(source)),
    visibility,
    format,
    idempotencyKey: source.idempotencyKey || `import-source:${digest}`,
    locator,
  }
}

export function parseSkillImportSources(input: unknown): NormalizedSkillImportSource[] {
  const raw = typeof input === 'string' ? JSON.parse(input) : input
  const list: unknown[] = Array.isArray(raw) ? raw : Array.isArray((raw as any)?.sources) ? (raw as any).sources : []
  return list.map((item: unknown, index: number) => normalizeSkillImportSource((item || {}) as SkillImportSourceInput, index))
}

function u16(n: number) {
  const b = Buffer.alloc(2)
  b.writeUInt16LE(n, 0)
  return b
}

function u32(n: number) {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(n, 0)
  return b
}

export function zipStore(files: Record<string, string | Buffer>) {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const [name, body] of Object.entries(files)) {
    const nameBuf = Buffer.from(name)
    const bodyBuf = Buffer.isBuffer(body) ? body : Buffer.from(body)
    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(bodyBuf.length),
      u32(bodyBuf.length),
      u16(nameBuf.length),
      u16(0),
      nameBuf,
      bodyBuf,
    ])
    locals.push(local)
    centrals.push(Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(bodyBuf.length),
      u32(bodyBuf.length),
      u16(nameBuf.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBuf,
    ]))
    offset += local.length
  }
  const central = Buffer.concat(centrals)
  const eocd = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(centrals.length),
    u16(centrals.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ])
  return Buffer.concat([...locals, central, eocd])
}

export function sourceTextToPackage(source: NormalizedSkillImportSource, text: string) {
  if (source.format === 'claude_skill') return { fileName: 'claude-skill.zip', buffer: zipStore({ 'SKILL.md': text }) }
  if (source.format === 'gpts') return { fileName: 'gpts.zip', buffer: zipStore({ [source.fileName || 'gpts.json']: text }) }
  return { fileName: 'github-readme.zip', buffer: zipStore({ 'README.md': text }) }
}


export function skillImportSourceHash(source: NormalizedSkillImportSource, body: Buffer | string): string {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body)
  return createHash('sha256')
    .update(source.format)
    .update('\0')
    .update(source.locator)
    .update('\0')
    .update(buffer)
    .digest('hex')
}

export function summarizeSkillImportDiff(previous: any, next: any): string[] {
  const changes: string[] = []
  const prevVersion = String(previous?.version || '')
  const nextVersion = String(next?.version || '')
  if (prevVersion && nextVersion && prevVersion !== nextVersion) changes.push(`version: ${prevVersion} -> ${nextVersion}`)
  const fields: Array<[string, string]> = [
    ['systemPrompt', 'system prompt'],
    ['promptTemplate', 'prompt template'],
    ['inputSchema', 'input schema'],
    ['outputSchema', 'output schema'],
    ['recommendedModels', 'recommended models'],
    ['routePolicy', 'route policy'],
    ['permissions', 'permissions'],
    ['minRunnerVersion', 'runner version'],
    ['examples', 'examples'],
  ]
  for (const [key, label] of fields) {
    const before = createHash('sha256').update(JSON.stringify(previous?.[key] ?? null)).digest('hex')
    const after = createHash('sha256').update(JSON.stringify(next?.[key] ?? null)).digest('hex')
    if (before !== after) changes.push(label)
  }
  return changes
}
