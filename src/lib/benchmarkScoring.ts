export type BenchmarkCaseForScoring = {
  id?: string
  title?: string
  expectedOutputShape?: unknown
  requiredOutputPaths?: unknown
  expectedTextIncludes?: unknown
  minScore?: number
}

export type BenchmarkCaseScore = {
  score: number
  passed: boolean
  checks: Array<{ code: string; ok: boolean; message: string }>
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : []
}

function getPath(obj: unknown, path: string): unknown {
  if (!path) return undefined
  return path.split('.').reduce((current: any, part) => {
    if (current == null) return undefined
    if (/^\d+$/.test(part)) return Array.isArray(current) ? current[Number(part)] : undefined
    return current[part]
  }, obj as any)
}

function shapePaths(shape: unknown, prefix = ''): string[] {
  if (!shape || typeof shape !== 'object' || Array.isArray(shape)) return []
  const out: string[] = []
  for (const [key, value] of Object.entries(shape as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    out.push(path)
    out.push(...shapePaths(value, path))
  }
  return out
}

export function evaluateBenchmarkCaseResult(args: {
  ok: boolean
  formatValid?: boolean
  output?: string
  outputJson?: unknown
  testCase?: BenchmarkCaseForScoring | null
}): BenchmarkCaseScore | undefined {
  const testCase = args.testCase
  if (!testCase) return undefined
  const checks: BenchmarkCaseScore['checks'] = []
  checks.push({ code: 'run_ok', ok: args.ok, message: args.ok ? '运行成功' : '运行失败' })

  const paths = [...new Set([...list(testCase.requiredOutputPaths), ...shapePaths(testCase.expectedOutputShape)])]
  for (const path of paths) {
    const value = getPath(args.outputJson, path)
    checks.push({ code: 'json_path', ok: value !== undefined && value !== null, message: `输出 JSON 路径 ${path}` })
  }

  const text = String(args.output || '')
  for (const needle of list(testCase.expectedTextIncludes)) {
    checks.push({ code: 'text_includes', ok: text.includes(needle), message: `输出包含文本 ${needle}` })
  }

  if (paths.length > 0) checks.push({ code: 'format_valid', ok: args.formatValid === true, message: '输出格式有效' })
  const passedChecks = checks.filter((check) => check.ok).length
  const score = checks.length ? Math.round((passedChecks / checks.length) * 1000) / 1000 : args.ok ? 1 : 0
  const minScore = Number.isFinite(testCase.minScore) ? Number(testCase.minScore) : 0.8
  return { score, passed: score >= minScore, checks }
}
