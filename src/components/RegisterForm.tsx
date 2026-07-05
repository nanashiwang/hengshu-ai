'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export function RegisterForm({ emailRequired }: { emailRequired: boolean }) {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', username: '', password: '', inviteCode: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const deviceId = getOrCreateDeviceId()
      const res = await fetch('/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, deviceId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) {
        setError(data.error || '注册失败')
        return
      }
      await fetch('/api/users/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.loginEmail || form.email, password: form.password }),
      })
      router.push('/console')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="mb-1 text-xl font-semibold">注册衡术 Hengshu</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        采用邀请制。已有账号？
        <Link href="/login" className="ml-1 text-[var(--accent)]">
          去登录
        </Link>
      </p>
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-6"
      >
        {error && <div className="text-sm text-[var(--danger)]">{error}</div>}
        <Field label="邀请码" value={form.inviteCode} onChange={(v) => set('inviteCode', v)} placeholder="输入你的邀请码" required />
        <Field label="用户名" value={form.username} onChange={(v) => set('username', v)} placeholder="昵称" required />
        <Field
          label={emailRequired ? '邮箱' : '邮箱（可选）'}
          type="email"
          value={form.email}
          onChange={(v) => set('email', v)}
          placeholder="you@example.com"
          required={emailRequired}
        />
        <Field label="密码" type="password" value={form.password} onChange={(v) => set('password', v)} placeholder="至少 8 位" required />
        <button
          disabled={loading}
          className="w-full rounded-md bg-[var(--accent)] px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {loading ? '注册中…' : '注册'}
        </button>
      </form>
    </div>
  )
}

function getOrCreateDeviceId(): string {
  const key = 'hs_device_id'
  try {
    const existing = window.localStorage.getItem(key)
    if (existing) return existing
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(key, id)
    return id
  } catch {
    return ''
  }
}

function Field({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-sm">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      />
    </div>
  )
}
