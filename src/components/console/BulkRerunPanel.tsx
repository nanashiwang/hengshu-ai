'use client'

import { useMemo, useState } from 'react'

const DEFAULT_MODELS = ['deepseek-chat', 'qwen-plus', 'qwen-turbo', 'glm-4-flash']
const CUSTOM_VALUE = '__custom__'

export function BulkRerunPanel({
  runIds,
  recommendedModels = [],
}: {
  runIds: string[]
  recommendedModels?: string[]
}) {
  const ids = useMemo(() => [...new Set((runIds || []).filter(Boolean))], [runIds])
  const options = useMemo(
    () => [...new Set([...(recommendedModels || []), ...DEFAULT_MODELS].filter(Boolean))],
    [recommendedModels],
  )
  const [selected, setSelected] = useState(options[0] || CUSTOM_VALUE)
  const [customModel, setCustomModel] = useState('')
  const [modelVersion, setModelVersion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  const model = selected === CUSTOM_VALUE ? customModel.trim() : selected

  async function rerunPage() {
    if (!ids.length || !model || loading) return
    setLoading(true)
    setErr(null)
    setResult(null)
    try {
      const res = await fetch('/v1/runs/rerun', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids,
          model,
          ...(modelVersion.trim() ? { modelVersion: modelVersion.trim() } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok || res.status === 207) setResult(data)
      else setErr(data.error || '批量重跑失败')
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-4 py-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-2 min-w-40">
          <div className="font-medium text-[var(--text)]">批量换模型重跑本页</div>
          <div className="text-[var(--muted)]">当前页 {ids.length} 条；响应只回摘要，不回显输入/输出。</div>
        </div>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-xs"
        >
          {options.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          <option value={CUSTOM_VALUE}>自定义模型…</option>
        </select>
        {selected === CUSTOM_VALUE && (
          <input
            value={customModel}
            onChange={(e) => setCustomModel(e.target.value)}
            placeholder="OpenAI 兼容模型名"
            className="w-44 rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-xs"
          />
        )}
        <input
          value={modelVersion}
          onChange={(e) => setModelVersion(e.target.value)}
          placeholder="模型版本（可选）"
          className="w-40 rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-xs"
        />
        <button
          onClick={rerunPage}
          disabled={loading || !ids.length || !model}
          className="rounded bg-[var(--accent)] px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {loading ? '批量重跑中…' : '重跑本页'}
        </button>
      </div>
      {err && <div className="mt-2 text-[var(--danger)]">{err}</div>}
      {result && (
        <div className="mt-2 rounded border border-[var(--border)] bg-[var(--bg)] p-2 text-[var(--muted)]">
          已完成：成功 {result.succeeded || 0} / 失败 {result.failed || 0}
          {Array.isArray(result.results) && result.results.length > 0 && (
            <div className="mt-1 max-h-28 overflow-auto">
              {result.results.slice(0, 8).map((item: any) => (
                <div key={item.sourceRunId} className={item.ok ? 'text-[var(--accent-2)]' : 'text-amber-300'}>
                  {item.sourceRunId}: {item.ok ? '成功' : item.error || item.errorCode || '失败'}
                  {item.savedAmount > 0 ? ` · 降本 ¥${Number(item.savedAmount).toFixed(4)}` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
