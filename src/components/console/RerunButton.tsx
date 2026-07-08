'use client'

import { useMemo, useState } from 'react'

// 换模型一键重跑：私人台账的切换成本核心钩子——用同一历史输入换个模型看效果/成本。
const DEFAULT_MODELS = ['deepseek-chat', 'qwen-plus', 'qwen-turbo', 'glm-4-flash']
const CUSTOM_VALUE = '__custom__'

export function RerunButton({
  runId,
  models,
  currentModel,
  currentModelVersion,
}: {
  runId: string
  models: string[]
  currentModel?: string
  currentModelVersion?: string
}) {
  const options = useMemo(
    () => [...new Set([...(models || []), ...DEFAULT_MODELS].filter((m) => m && m !== currentModel))],
    [models, currentModel],
  )
  const [selected, setSelected] = useState(options[0] || CUSTOM_VALUE)
  const [customModel, setCustomModel] = useState('')
  const [modelVersion, setModelVersion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)

  const model = selected === CUSTOM_VALUE ? customModel.trim() : selected

  async function rerun() {
    if (!model || loading) return
    setLoading(true)
    setErr(null)
    setResult(null)
    try {
      const res = await fetch(`/v1/runs/${runId}/rerun`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          ...(modelVersion.trim() ? { modelVersion: modelVersion.trim() } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) setResult(data)
      else setErr((data.errors && data.errors[0]) || data.error || '重跑失败')
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-2 border-t border-[var(--border)] pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[var(--muted)]">换模型重跑：</span>
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
          placeholder={currentModelVersion ? `版本：${currentModelVersion}` : '模型版本（可选）'}
          className="w-40 rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-xs"
        />
        <button
          onClick={rerun}
          disabled={loading || !model}
          className="rounded bg-[var(--accent)] px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {loading ? '重跑中…' : '重跑'}
        </button>
      </div>
      <div className="mt-1 text-[11px] text-[var(--faint)]">同一历史输入、同一 Skill 版本，只切换模型/版本；新结果会写入你的私人运行台账。</div>
      {err && <div className="mt-1 text-xs text-[var(--danger)]">{err}</div>}
      {result && (
        <div className="mt-2 rounded bg-[var(--panel)] p-2 text-xs">
          <div className="mb-1 text-[var(--muted)]">
            已写入台账 · {result.model} · 成本 ¥{Number(result.cost || 0).toFixed(4)}
            {result.modelVersion ? ` · 版本 ${result.modelVersion}` : ''}
            {result.savedAmount > 0 ? ` · 降本 ¥${Number(result.savedAmount).toFixed(4)}` : ''}
            {result.mocked ? ' · [MOCK]' : ''}
          </div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words">
            {String(result.output || '（无输出）').slice(0, 4000)}
          </pre>
        </div>
      )}
    </div>
  )
}
