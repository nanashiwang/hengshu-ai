'use client'

import { useState } from 'react'

type DevicePreview = {
  runnerVersion?: string | null
  os?: string | null
  arch?: string | null
  label?: string | null
  expiresAt?: string | null
}

export function DeviceAuthForm({ initialCode }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode || '')
  const [preview, setPreview] = useState<DevicePreview | null>(null)
  const [state, setState] = useState<'idle' | 'ok' | 'err'>('idle')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch('/v1/auth/device/authorize', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userCode: code, confirm: !!preview }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.requiresConfirmation) {
        setState('idle')
        setPreview(data.device || {})
        setMsg('请确认这是你正在登录的 Runner 设备。')
      } else if (res.ok && data.ok) {
        setState('ok')
        setMsg('授权成功！可以回到终端，Runner 将自动完成登录。')
      } else {
        setState('err')
        setPreview(null)
        setMsg(data.error || '授权失败')
      }
    } catch (e: any) {
      setState('err')
      setPreview(null)
      setMsg(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (state === 'ok') {
    return (
      <div className="card p-6 text-center">
        <div className="text-3xl">✅</div>
        <p className="mt-2 text-sm">{msg}</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      {state === 'err' && <div className="text-sm text-[var(--danger)]">{msg}</div>}
      {msg && state !== 'err' && <div className="text-sm text-[var(--muted)]">{msg}</div>}
      <div>
        <label className="mb-1 block text-sm">设备授权码</label>
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
            setPreview(null)
          }}
          placeholder="ABCD-7K9M"
          className="input text-center font-mono text-lg tracking-widest"
        />
      </div>
      {preview && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-3 text-xs text-[var(--muted)]">
          <div className="font-medium text-[var(--text)]">即将授权的 Runner</div>
          <div className="mt-1">设备：{preview.label || '未命名设备'}</div>
          <div>系统：{[preview.os, preview.arch].filter(Boolean).join(' / ') || '未知'}</div>
          <div>版本：{preview.runnerVersion || '未知'}</div>
          {preview.expiresAt && <div>过期：{new Date(preview.expiresAt).toLocaleString()}</div>}
          <div className="mt-2 text-[var(--danger)]">如果这不是你自己的终端，请不要授权。</div>
        </div>
      )}
      <button disabled={loading || !code} className="btn btn-primary w-full">
        {loading ? '处理中…' : preview ? '确认授权此设备' : '下一步：查看设备信息'}
      </button>
    </form>
  )
}
