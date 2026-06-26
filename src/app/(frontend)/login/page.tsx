'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.errors?.[0]?.message || data?.message || '登录失败')
        return
      }
      router.push('/me')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="mb-1 text-xl font-semibold">登录元衡 SkillHub</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        还没有账号？
        <Link href="/register" className="ml-1 text-[var(--accent)]">
          邀请码注册
        </Link>
      </p>
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-6"
      >
        {error && <div className="text-sm text-[var(--danger)]">{error}</div>}
        <Field label="邮箱" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
        <Field label="密码" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
        <button
          disabled={loading}
          className="w-full rounded-md bg-[var(--accent)] px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {loading ? '登录中…' : '登录'}
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-[var(--muted)]">
        种子管理员：admin@yuanheng.ai / admin12345
      </p>
    </div>
  )
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      />
    </div>
  )
}
