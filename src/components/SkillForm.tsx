'use client'

import { useState } from 'react'

interface Category {
  slug: string
  name: string
}

// 创作者发布 Skill 表单（前台，替代 Payload 后台裸 CRUD）
export function SkillForm({ categories }: { categories: Category[] }) {
  const [form, setForm] = useState({
    title: '',
    categorySlug: '',
    description: '',
    systemPrompt: '',
    promptTemplate: '',
    inputSchema: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.promptTemplate.trim()) {
      setError('名称与 User 模板为必填')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/v1/skills', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d?.error || '发布失败')
        return
      }
      // 提交进 pending，审核通过后上架（详情页对非 published 不可见，故不跳详情、改为成功态）
      setDone(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="max-w-2xl rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6 text-sm">
        <p className="mb-2 text-base font-medium">✓ 已提交，进入待审核</p>
        <p className="mb-4 text-[var(--muted)]">审核通过后即在市场上架。</p>
        <div className="flex gap-4">
          <a href="/console" className="text-[var(--accent)]">
            返回控制台
          </a>
          <button
            type="button"
            onClick={() => {
              setDone(false)
              setForm({ title: '', categorySlug: '', description: '', systemPrompt: '', promptTemplate: '', inputSchema: '' })
            }}
            className="text-[var(--accent)]"
          >
            再发一个
          </button>
        </div>
      </div>
    )
  }

  const inputCls =
    'w-full rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]'
  const labelCls = 'block text-sm font-medium mb-1'
  const hintCls = 'text-xs text-[var(--muted)] mb-1'

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4">
      {error && <div className="rounded-md bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}

      <div>
        <label className={labelCls}>Skill 名称 *</label>
        <input value={form.title} onChange={(e) => set('title', e.target.value)} className={inputCls} placeholder="如：小红书标题生成器" required />
      </div>

      <div>
        <label className={labelCls}>分类</label>
        <select value={form.categorySlug} onChange={(e) => set('categorySlug', e.target.value)} className={inputCls}>
          <option value="">（不选）</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls}>简介</label>
        <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} className={inputCls} placeholder="一句话说明这个 Skill 做什么" />
      </div>

      <div>
        <label className={labelCls}>System Prompt（角色/约束，可空）</label>
        <textarea value={form.systemPrompt} onChange={(e) => set('systemPrompt', e.target.value)} rows={3} className={`${inputCls} font-mono`} placeholder="你是一个专业的文案助手…" />
      </div>

      <div>
        <label className={labelCls}>User 模板 *</label>
        <p className={hintCls}>Spec v1 的 user_template，支持 {'{{变量名}}'} 占位符（对应下方输入字段）。</p>
        <textarea value={form.promptTemplate} onChange={(e) => set('promptTemplate', e.target.value)} rows={4} className={`${inputCls} font-mono`} placeholder={'为主题「{{topic}}」写 5 个小红书标题'} required />
      </div>

      <div>
        <label className={labelCls}>输入字段定义（可选，JSON）</label>
        <p className={hintCls}>定义模板里的变量，供运行时表单渲染。留空则无输入字段。</p>
        <textarea
          value={form.inputSchema}
          onChange={(e) => set('inputSchema', e.target.value)}
          rows={3}
          className={`${inputCls} font-mono`}
          placeholder={'{"topic":{"type":"string","label":"主题","required":true}}'}
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button disabled={loading} className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {loading ? '提交中…' : '提交发布（进审核）'}
        </button>
        <span className="text-xs text-[var(--muted)]">提交后进入待审核，审核通过即上架。</span>
      </div>
    </form>
  )
}
