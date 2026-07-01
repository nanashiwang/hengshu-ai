'use client'

import React, { useState } from 'react'

// 「状态/开关切换」操作：field 指定要切换的字段，on/off 为两态取值
type Toggle = { field: string; on: any; off: any; onLabel: string; offLabel: string }

// 各集合的切换操作（无配置则仅提供删除）
const TOGGLES: Record<string, Toggle> = {
  skills: { field: 'status', on: 'published', off: 'archived', onLabel: '下架', offLabel: '发布' },
  'skill-versions': { field: 'status', on: 'active', off: 'deprecated', onLabel: '废弃', offLabel: '启用' },
  'contribution-rules': { field: 'enabled', on: true, off: false, onLabel: '停用', offLabel: '启用' },
  'runner-clients': {
    field: 'trustedLevel',
    on: 'verified',
    off: 'community',
    onLabel: '取消可信',
    offLabel: '设为可信',
  },
}

// 通用列表行内操作 Cell：状态/开关切换（按集合）+ 删除。复用于后台各表。
// collection 经 clientProps 注入；rowData 由 Payload 列表注入（含 id 及各字段）
export function RowActions(props: any) {
  const collection: string | undefined = props?.collection || props?.collectionSlug
  const row = props?.rowData || {}
  const id: string | undefined = row.id
  const [busy, setBusy] = useState(false)

  if (!id || !collection) return null

  const run = async (fn: () => Promise<Response>, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return
    setBusy(true)
    try {
      const res = await fn()
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert(j?.errors?.[0]?.message || '操作失败')
        setBusy(false)
        return
      }
      window.location.reload()
    } catch (e: any) {
      alert(e?.message || '操作失败')
      setBusy(false)
    }
  }

  const patch = (data: Record<string, unknown>) =>
    run(() =>
      fetch(`/api/${collection}/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    )

  const del = async () => {
    // 禁止删除当前登录账号，避免把自己删掉
    if (collection === 'users') {
      try {
        const me = await (await fetch('/api/users/me', { credentials: 'include' })).json()
        if (me?.user?.id === id) {
          alert('不能删除当前登录的账号')
          return
        }
      } catch {
        /* 忽略 */
      }
    }
    run(
      () => fetch(`/api/${collection}/${id}`, { method: 'DELETE', credentials: 'include' }),
      '确认删除该记录？此操作不可恢复。',
    )
  }

  const btn: React.CSSProperties = {
    border: '1px solid var(--theme-elevation-150)',
    background: 'var(--theme-elevation-0)',
    color: 'var(--theme-text)',
    borderRadius: 4,
    padding: '3px 9px',
    fontSize: 12,
    lineHeight: 1.4,
    cursor: busy ? 'default' : 'pointer',
    opacity: busy ? 0.5 : 1,
    whiteSpace: 'nowrap',
  }

  const toggle = TOGGLES[collection]
  let toggleBtn: React.ReactNode = null
  if (toggle) {
    const isOn = row[toggle.field] === toggle.on
    const label = isOn ? toggle.onLabel : toggle.offLabel
    const next = isOn ? toggle.off : toggle.on
    toggleBtn = (
      <button type="button" disabled={busy} style={btn} onClick={() => patch({ [toggle.field]: next })}>
        {label}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
      {toggleBtn}
      <button
        type="button"
        disabled={busy}
        style={{ ...btn, color: 'var(--theme-error-500)', borderColor: 'var(--theme-error-500)' }}
        onClick={del}
      >
        删除
      </button>
    </div>
  )
}
