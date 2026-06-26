'use client'

import { useState } from 'react'
import Link from 'next/link'

interface FieldDef {
  type?: string
  label?: string
  required?: boolean
  options?: Array<string | { label?: string; value?: string }>
  placeholder?: string
}

const ROUTE_MODES = [
  { value: 'balanced', label: '均衡' },
  { value: 'cheap', label: '省钱' },
  { value: 'quality', label: '高质量' },
  { value: 'fast', label: '快速' },
]

function optionValue(o: string | { label?: string; value?: string }) {
  return typeof o === 'string' ? o : (o.value ?? o.label ?? '')
}
function optionLabel(o: string | { label?: string; value?: string }) {
  return typeof o === 'string' ? o : (o.label ?? o.value ?? '')
}

export function RunForm({
  slug,
  inputSchema,
  loggedIn,
}: {
  slug: string
  inputSchema: Record<string, FieldDef>
  loggedIn: boolean
}) {
  const fields = Object.entries(inputSchema || {})
  const [values, setValues] = useState<Record<string, string>>({})
  const [routeMode, setRouteMode] = useState('balanced')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`/v1/skills/${slug}/run`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: values, routeMode }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        setError('请先登录后再运行。')
        return
      }
      if (!res.ok || data.ok === false) {
        setError((data.errors && data.errors.join('；')) || data.error || '运行失败')
        return
      }
      setResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* 表单 */}
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5"
      >
        {fields.length === 0 && (
          <p className="text-sm text-[var(--muted)]">该 Skill 无需输入，直接运行即可。</p>
        )}
        {fields.map(([key, def]) => (
          <div key={key}>
            <label className="mb-1 block text-sm">
              {def.label || key}
              {def.required && <span className="ml-1 text-[var(--danger)]">*</span>}
            </label>
            {def.type === 'select' && def.options ? (
              <select
                value={values[key] || ''}
                onChange={(e) => set(key, e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              >
                <option value="">请选择…</option>
                {def.options.map((o, i) => (
                  <option key={i} value={optionValue(o)}>
                    {optionLabel(o)}
                  </option>
                ))}
              </select>
            ) : def.type === 'text' ? (
              <textarea
                value={values[key] || ''}
                onChange={(e) => set(key, e.target.value)}
                placeholder={def.placeholder}
                rows={4}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            ) : (
              <input
                value={values[key] || ''}
                onChange={(e) => set(key, e.target.value)}
                placeholder={def.placeholder}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            )}
          </div>
        ))}

        <div>
          <label className="mb-1 block text-sm">路由模式</label>
          <div className="flex flex-wrap gap-2">
            {ROUTE_MODES.map((m) => (
              <button
                type="button"
                key={m.value}
                onClick={() => setRouteMode(m.value)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  routeMode === m.value
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-[var(--border)] text-[var(--muted)]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <button
          disabled={loading || !loggedIn}
          className="w-full rounded-md bg-[var(--accent)] px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {loading ? '运行中…' : loggedIn ? '▶ 运行 Skill' : '请先登录'}
        </button>
        {!loggedIn && (
          <p className="text-center text-xs text-[var(--muted)]">
            <Link href="/login" className="text-[var(--accent)]">
              登录
            </Link>{' '}
            后即可运行
          </p>
        )}
      </form>

      {/* 结果 */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
        <h3 className="mb-3 text-sm font-semibold">运行结果</h3>
        {error && (
          <div className="rounded-md border border-[var(--danger)] bg-[var(--panel-2)] p-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}
        {!error && !result && (
          <p className="text-sm text-[var(--muted)]">填写左侧表单并点击运行，结果将显示在这里。</p>
        )}
        {result && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              {result.mocked && (
                <span className="rounded border border-[var(--warn)] px-2 py-0.5 text-[var(--warn)]">
                  MOCK（未配置 New API）
                </span>
              )}
              <span className="rounded border border-[var(--border)] px-2 py-0.5 text-[var(--muted)]">
                模型 {result.model}
              </span>
              <span className="rounded border border-[var(--border)] px-2 py-0.5 text-[var(--muted)]">
                成本 ¥{result.cost ?? 0}
              </span>
              <span className="rounded border border-[var(--border)] px-2 py-0.5 text-[var(--muted)]">
                耗时 {result.latencyMs ?? 0}ms
              </span>
              {result.tokens && (
                <span className="rounded border border-[var(--border)] px-2 py-0.5 text-[var(--muted)]">
                  {result.tokens.total} tokens
                </span>
              )}
              <span
                className={`rounded border px-2 py-0.5 ${
                  result.formatValid
                    ? 'border-[var(--accent-2)] text-[var(--accent-2)]'
                    : 'border-[var(--danger)] text-[var(--danger)]'
                }`}
              >
                格式{result.formatValid ? '有效' : '无效'}
              </span>
            </div>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--panel-2)] p-3 text-sm">
              {result.output}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
