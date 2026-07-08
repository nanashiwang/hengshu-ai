import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { getPayload } from 'payload'
import config from '@payload-config'
import { slugify } from '@/lib/slug'
import { resolveRuntimeEnv } from '@/lib/deploymentSettings'
import {
  analyzeSkillPackage,
  packageStatusForReview,
  reviewSkillPackage,
  reviewToChangelog,
  storeSkillPackage,
} from '@/lib/skillPackage'
import { normalizeSkillSubmissionKey } from '@/lib/skillSubmission'
import {
  parseSkillImportSources,
  skillImportSourceHash,
  sourceTextToPackage,
  summarizeSkillImportDiff,
  type NormalizedSkillImportSource,
} from '@/lib/skillSourceImport'

function arg(name: string) {
  const prefix = `--${name}=`
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length)
}

function parseJson(value?: string) {
  if (!value) return null
  return JSON.parse(value)
}

function flag(name: string) {
  return process.argv.includes(`--${name}`) || process.env[`IMPORT_${name.toUpperCase().replace(/-/g, '_')}`] === '1'
}

async function readBytes(source: NormalizedSkillImportSource) {
  if (source.content != null) return Buffer.from(source.content)
  if (source.path) return readFile(path.resolve(source.path))
  if (!source.url) throw new Error('缺少 url/path/content')
  const response = await fetch(source.url)
  if (!response.ok) throw new Error(`下载失败 ${response.status}: ${source.url}`)
  return Buffer.from(await response.arrayBuffer())
}


async function sourceToPackage(source: NormalizedSkillImportSource) {
  const sourceBytes = await readBytes(source)
  const sourceHash = skillImportSourceHash(source, sourceBytes)
  if (source.format === 'package') {
    const fileName = source.fileName || source.path?.split(/[\\/]/).pop() || source.url?.split(/[?#]/)[0].split('/').pop() || 'skill-package.zip'
    return { fileName, buffer: sourceBytes, sourceHash }
  }
  return { ...sourceTextToPackage(source, sourceBytes.toString('utf8')), sourceHash }
}

async function resolveAuthor(payload: any) {
  const email = process.env.IMPORT_AUTHOR_EMAIL || arg('authorEmail')
  const where = email
    ? { email: { equals: email } }
    : { or: [{ role: { equals: 'admin' } }, { role: { equals: 'reviewer' } }, { role: { equals: 'creator' } }] }
  const users = await payload.find({ collection: 'users', where, limit: 1, depth: 0, overrideAccess: true })
  const user = users.docs[0]
  if (!user) throw new Error(email ? `找不到导入作者：${email}` : '找不到 admin/reviewer/creator 作为导入作者')
  return user
}

async function resolveCategory(payload: any, categorySlug?: string) {
  if (!categorySlug) return undefined
  const cats = await payload.find({ collection: 'categories', where: { slug: { equals: categorySlug } }, limit: 1, depth: 0, overrideAccess: true })
  return cats.docs[0]?.id
}

async function findExisting(payload: any, idempotencyKey: string) {
  const existing = await payload.find({
    collection: 'skills',
    where: { clientSubmissionKey: { equals: idempotencyKey } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return existing.docs[0] || null
}

async function uniqueSlug(payload: any, title: string) {
  const base = slugify(title)
  let slug = base
  for (let i = 0; i < 20; i++) {
    const exists = await payload.find({ collection: 'skills', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })
    if (!exists.docs[0]) return slug
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`
  }
  return `${base}-${Date.now().toString(36)}`
}

function normalizeModels(models: any) {
  if (!models || typeof models !== 'object' || Array.isArray(models)) return models
  if (models.cloud || models.local) return models
  const out: Record<string, unknown> = { ...models }
  if (Array.isArray(models.cloud_recommended)) out.cloud = models.cloud_recommended
  if (Array.isArray(models.local_recommended)) out.local = models.local_recommended
  return out
}

function fallbackPromptTemplate(title: string, description: string, analysis: ReturnType<typeof analyzeSkillPackage>) {
  const readme = (analysis.readmeText || '').slice(0, 3000)
  const fileList = analysis.entries.slice(0, 80).map((entry) => `- ${entry.name}`).join('\n')
  return [
    `你正在运行导入的 Skill「${title}」。`,
    description ? `简介：${description}` : '',
    readme ? `README：\n${readme}` : '',
    fileList ? `包内文件：\n${fileList}` : '',
    '',
    '用户本次任务：',
    '{{request}}',
  ].filter(Boolean).join('\n')
}

async function importOne(payload: any, source: NormalizedSkillImportSource, author: any, runtimeEnv: Record<string, string | undefined>, syncExisting = false) {
  const key = normalizeSkillSubmissionKey(source.idempotencyKey) || source.idempotencyKey
  const pkg = await sourceToPackage(source)
  const existing = await findExisting(payload, key)
  if (existing && existing.importSourceHash === pkg.sourceHash) {
    return { title: source.title, status: existing.status, slug: existing.slug, idempotent: true, changed: false }
  }
  if (existing && !syncExisting) {
    return { title: source.title, status: existing.status, slug: existing.slug, idempotent: true, changed: true, action: 'skipped_update' }
  }

  const analysis = analyzeSkillPackage(pkg.fileName, pkg.buffer)
  const blocker = analysis.issues.find((issue) => issue.level === 'blocker')
  if (blocker) return { title: source.title, status: 'blocked', code: blocker.code, error: blocker.message }

  const review = await reviewSkillPackage({ title: source.title, description: source.description, analysis, env: runtimeEnv })
  const status = packageStatusForReview(review, analysis)
  const category = await resolveCategory(payload, source.categorySlug)

  if (existing) {
    const currentVersionId = typeof existing.currentVersion === 'object' ? existing.currentVersion?.id : existing.currentVersion
    const previousVersion = currentVersionId
      ? await payload.findByID({ collection: 'skill-versions', id: String(currentVersionId), depth: 0, overrideAccess: true }).catch(() => null)
      : null
    const changes = summarizeSkillImportDiff(previousVersion, analysis)
    const version = await payload.create({
      collection: 'skill-versions',
      overrideAccess: true,
      data: {
        skill: existing.id,
        version: analysis.version || previousVersion?.version || '1.0.0',
        systemPrompt: analysis.systemPrompt,
        promptTemplate: analysis.promptTemplate || fallbackPromptTemplate(source.title, source.description || existing.description || '', analysis),
        inputSchema: analysis.inputSchema || previousVersion?.inputSchema || { request: { type: 'text', label: '本次任务', required: true } },
        outputSchema: analysis.outputSchema,
        recommendedModels: normalizeModels(analysis.recommendedModels),
        routePolicy: analysis.routePolicy,
        examples: analysis.examples,
        license: analysis.license,
        minRunnerVersion: analysis.minRunnerVersion,
        permissions: analysis.permissions,
        changelog: [
          `来源同步：${source.format}`,
          source.url ? `URL：${source.url}` : '',
          changes.length ? `变更：${changes.join(', ')}` : '变更：内容 hash 更新',
          reviewToChangelog(review, analysis),
        ].filter(Boolean).join('\n'),
        status: 'active',
        createdBy: author.id,
      },
    })
    await storeSkillPackage({ skillId: existing.id, versionId: version.id, analysis, buffer: pkg.buffer })
    const updated = await payload.update({
      collection: 'skills',
      id: existing.id,
      overrideAccess: true,
      data: {
        description: source.description || existing.description || analysis.manifest?.description || analysis.readmeText?.slice(0, 220) || undefined,
        category: category || existing.category,
        status,
        visibility: source.visibility || existing.visibility,
        currentVersion: version.id,
        importSourceFormat: source.format,
        importSourceLocator: source.locator,
        importSourceHash: pkg.sourceHash,
        importSourceLastSyncedAt: new Date().toISOString(),
        importSourceLastDiff: { action: 'updated', changes },
      },
    })
    return {
      title: source.title,
      status: updated.status,
      slug: updated.slug,
      changed: true,
      action: 'updated',
      diff: changes,
      sourceFormat: analysis.sourceFormat,
      review: review.decision,
      issues: analysis.issues.map((issue) => issue.code),
    }
  }

  const slug = await uniqueSlug(payload, source.title)
  const skill = await payload.create({
    collection: 'skills',
    overrideAccess: true,
    data: {
      title: source.title,
      slug,
      description: source.description || analysis.manifest?.description || analysis.readmeText?.slice(0, 220) || undefined,
      category,
      author: author.id,
      clientSubmissionKey: key,
      status,
      visibility: source.visibility,
      importSourceFormat: source.format,
      importSourceLocator: source.locator,
      importSourceHash: pkg.sourceHash,
      importSourceLastSyncedAt: new Date().toISOString(),
      importSourceLastDiff: { action: 'created', changes: ['new source'] },
    },
  })
  const version = await payload.create({
    collection: 'skill-versions',
    overrideAccess: true,
    data: {
      skill: skill.id,
      version: analysis.version || '1.0.0',
      systemPrompt: analysis.systemPrompt,
      promptTemplate: analysis.promptTemplate || fallbackPromptTemplate(source.title, source.description || '', analysis),
      inputSchema: analysis.inputSchema || { request: { type: 'text', label: '本次任务', required: true } },
      outputSchema: analysis.outputSchema,
      recommendedModels: normalizeModels(analysis.recommendedModels),
      routePolicy: analysis.routePolicy,
      examples: analysis.examples,
      license: analysis.license,
      minRunnerVersion: analysis.minRunnerVersion,
      permissions: analysis.permissions,
      changelog: [`来源导入：${source.format}`, source.url ? `URL：${source.url}` : '', reviewToChangelog(review, analysis)].filter(Boolean).join('\n'),
      status: 'active',
      createdBy: author.id,
    },
  })
  await storeSkillPackage({ skillId: skill.id, versionId: version.id, analysis, buffer: pkg.buffer })
  return {
    title: source.title,
    status,
    slug,
    sourceFormat: analysis.sourceFormat,
    review: review.decision,
    issues: analysis.issues.map((issue) => issue.code),
  }
}

async function main() {
  const file = arg('file') || process.env.IMPORT_SOURCES_FILE
  const raw = file ? await readFile(path.resolve(file), 'utf8') : process.env.IMPORT_SOURCES_JSON
  if (!raw) throw new Error('请提供 --file=imports.json 或 IMPORT_SOURCES_JSON')

  const sources = parseSkillImportSources(parseJson(raw) || raw)
  if (!sources.length) throw new Error('没有可导入的来源')

  const payload = await getPayload({ config })
  const author = await resolveAuthor(payload)
  const runtimeEnv = await resolveRuntimeEnv(payload)
  const results = []
  const syncExisting = flag('sync')
  for (const source of sources) {
    try {
      results.push(await importOne(payload, source, author, runtimeEnv, syncExisting))
    } catch (error) {
      results.push({ title: source.title, status: 'error', error: error instanceof Error ? error.message : String(error) })
    }
  }
  const output = { ok: results.every((result: any) => !['error', 'blocked'].includes(result.status)), imported: results.length, results }
  const outFile = arg('out') || process.env.IMPORT_SOURCES_OUT
  if (outFile) await writeFile(path.resolve(outFile), `${JSON.stringify(output, null, 2)}\n`)
  console.log(JSON.stringify(output, null, 2))
  if (!output.ok) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
