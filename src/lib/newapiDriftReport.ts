import { chmod, lstat, mkdir, open, rename, unlink } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import {
  formatUserUsageDriftJsonl,
  type NewApiUsageSource,
  type UserUsageDriftResult,
} from '@/lib/newapiReconcile'

export interface DriftReportPathOptions {
  explicitPath?: string
  cwd?: string
  monthStart: Date
}

export interface WriteUserDriftReportOptions extends DriftReportPathOptions {
  usageSource: NewApiUsageSource
  generatedAt?: Date
}

function assertJsonlReportPath(path: string): void {
  if (!basename(path).endsWith('.jsonl')) {
    throw new Error('NEWAPI_RECONCILE_DRIFT_REPORT_PATH 必须指向 .jsonl 文件，避免误覆盖 .env/代码/配置文件')
  }
}

async function assertSafeExistingReportPath(path: string): Promise<void> {
  try {
    const stat = await lstat(path)
    if (stat.isSymbolicLink()) {
      throw new Error('NEWAPI_RECONCILE_DRIFT_REPORT_PATH 不能是软链接，避免对账报告跟随软链覆盖敏感文件')
    }
    if (!stat.isFile()) {
      throw new Error('NEWAPI_RECONCILE_DRIFT_REPORT_PATH 必须指向普通 .jsonl 文件')
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
}

export function resolveReconcileDriftReportPath(opts: DriftReportPathOptions): string {
  const explicit = opts.explicitPath?.trim()
  const path = explicit
    ? resolve(explicit)
    : resolve(opts.cwd || process.cwd(), '.reconcile-reports', `newapi-drift-${opts.monthStart.toISOString().slice(0, 7)}.jsonl`)
  assertJsonlReportPath(path)
  return path
}

export async function writeUserDriftReportFile(
  rows: UserUsageDriftResult[],
  opts: WriteUserDriftReportOptions,
): Promise<string | null> {
  if (rows.length === 0) return null
  const path = resolveReconcileDriftReportPath(opts)
  const dir = dirname(path)
  await mkdir(dir, { recursive: true })
  await assertSafeExistingReportPath(path)
  const text = formatUserUsageDriftJsonl(rows, {
    monthStartISO: opts.monthStart.toISOString(),
    generatedAt: (opts.generatedAt || new Date()).toISOString(),
    usageSource: opts.usageSource,
  })
  const tempPath = resolve(
    dir,
    `.${basename(path)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`,
  )
  let tempCreated = false
  try {
    const file = await open(tempPath, 'wx', 0o600)
    tempCreated = true
    try {
      await file.writeFile(`${text}\n`, 'utf8')
      await file.chmod(0o600)
    } finally {
      await file.close()
    }
    await rename(tempPath, path)
    await chmod(path, 0o600)
  } catch (error) {
    if (tempCreated) await unlink(tempPath).catch(() => undefined)
    throw error
  }
  return path
}
