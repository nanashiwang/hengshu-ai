'use client'

import { useEffect, useState } from 'react'

/** 用于尚未开放的功能：点击给出明确反馈，而不是静默禁用 */
export function SoonButton({
  label,
  icon,
  message = '该功能将在后续阶段开放',
  className = '',
}: {
  label: string
  icon?: string
  message?: string
  className?: string
}) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => setShow(false), 2200)
    return () => clearTimeout(t)
  }, [show])

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setShow(true)}
        className={`btn btn-secondary ${className}`}
      >
        {icon && <span>{icon}</span>}
        {label}
      </button>
      {show && (
        <span className="animate-in absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-1 text-xs text-[var(--muted)] shadow">
          {message}
        </span>
      )}
    </span>
  )
}
