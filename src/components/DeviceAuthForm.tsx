'use client'

import { useState } from 'react'

export function DeviceAuthForm({ initialCode }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode || '')
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
        body: JSON.stringify({ userCode: code }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setState('ok')
        setMsg('授权成功！可以回到终端，Runner 将自动完成登录。')
      } else {
        setState('err')
        setMsg(data.error || '授权失败')
      }
    } catch (e: any) {
      setState('err')
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
      <div>
        <label className="mb-1 block text-sm">设备授权码</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABCD-7K9M"
          className="input text-center font-mono text-lg tracking-widest"
        />
      </div>
      <button disabled={loading || !code} className="btn btn-primary w-full">
        {loading ? '授权中…' : '授权此设备'}
      </button>
    </form>
  )
}
