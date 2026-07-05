'use client'

import { useCallback, useEffect, useState } from 'react'

interface Status {
  enabled: boolean
  pointsPerCredit: number
  minCreditPerTx: number
  perTxMaxCredit: number
  poolRemainingCredit: number
  userDailyRemaining: number
  userMonthlyRemaining: number
  contributionScore: number
  creditBalance: number
}

// 术值 → credit 兑换面板。幂等键客户端生成，防重试/双击重复兑换。
export function ExchangePanel() {
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [credit, setCredit] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [rechargeCode, setRechargeCode] = useState('')
  const [recharging, setRecharging] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/v1/economy/exchange', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) setStatus(data)
      else setMsg({ type: 'err', text: data.error || '加载失败' })
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <div className="text-sm text-[var(--muted)]">加载中…</div>
  if (!status) return <div className="text-sm text-[var(--danger)]">{msg?.text || '加载失败'}</div>

  const n = Math.floor(Number(credit)) || 0
  const rate = Math.max(1, status.pointsPerCredit)
  const pointsCost = n * status.pointsPerCredit
  // 综合上限：单次 / 池剩余 / 每日 / 每月 / 术值可换
  const maxByAll = Math.min(
    status.perTxMaxCredit,
    status.poolRemainingCredit,
    status.userDailyRemaining,
    status.userMonthlyRemaining,
    Math.floor(status.contributionScore / rate),
  )
  const invalid = n < status.minCreditPerTx || n > maxByAll || maxByAll < status.minCreditPerTx

  async function submit() {
    if (invalid || submitting) return
    setSubmitting(true)
    setMsg(null)
    try {
      const res = await fetch('/v1/economy/exchange', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credit: n, idempotencyKey: newIdempotencyKey() }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setMsg({
          type: 'ok',
          text: data.already
            ? '该兑换已处理'
            : `兑换成功：+${data.creditGranted} credit（花费 ${data.pointsSpent} 术值）`,
        })
        setCredit('')
        await load()
      } else {
        setMsg({ type: 'err', text: data.error || '兑换失败' })
      }
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message })
    } finally {
      setSubmitting(false)
    }
  }

  async function submitRecharge() {
    const code = rechargeCode.trim()
    if (!code || recharging) return
    setRecharging(true)
    setMsg(null)
    try {
      const res = await fetch('/v1/economy/recharge', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setMsg({ type: 'ok', text: `充值成功：+${data.creditGranted} credit` })
        setRechargeCode('')
        await load()
      } else {
        setMsg({ type: 'err', text: data.error || '充值失败' })
      }
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message })
    } finally {
      setRecharging(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 余额 */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="术值余额" value={`⚡ ${status.contributionScore}`} accent="var(--accent)" />
        <Stat label="credit 余额" value={`◆ ${status.creditBalance}`} accent="var(--accent-2)" />
      </div>

      {/* 充值码入口 */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-3">
        <label className="mb-1 block text-sm">充值码</label>
        <div className="flex flex-wrap gap-2">
          <input
            value={rechargeCode}
            onChange={(e) => setRechargeCode(e.target.value)}
            placeholder="输入一次性充值码"
            className="min-w-64 rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <button
            onClick={submitRecharge}
            disabled={!rechargeCode.trim() || recharging}
            className="rounded-md bg-[var(--accent-2)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {recharging ? '充值中…' : '充值 credit'}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-[var(--muted)]">用于外部付款/运营发放后的一次性 credit 入账；credit 不可提现。</p>
      </div>

      {status.enabled ? (
        <>
          {/* 规则 */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-3 text-xs text-[var(--muted)]">
            <div>兑换率：<b className="text-[var(--text)]">{status.pointsPerCredit} 术值 = 1 credit</b>（1 credit = ¥0.01 算力）</div>
            <div className="mt-1">单次 {status.minCreditPerTx}–{status.perTxMaxCredit} credit · 今日剩余额度 {status.userDailyRemaining} · 本月剩余 {status.userMonthlyRemaining}</div>
            <div className="mt-1">兑换池剩余：<b className="text-[var(--text)]">{status.poolRemainingCredit} credit</b>（池 = 平台已实现毛利的一部分，先赚到才有得兑）</div>
          </div>

          {/* 兑换输入 */}
          <div>
            <label className="mb-1 block text-sm">兑换 credit 数量</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={status.minCreditPerTx}
                max={maxByAll}
                value={credit}
                onChange={(e) => setCredit(e.target.value)}
                placeholder={`${status.minCreditPerTx} ~ ${Math.max(0, maxByAll)}`}
                className="w-40 rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
              <button
                onClick={submit}
                disabled={invalid || submitting}
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {submitting ? '兑换中…' : '兑换'}
              </button>
            </div>
            {n > 0 && (
              <p className="mt-1.5 text-xs text-[var(--muted)]">
                将花费 <b className="text-[var(--text)]">{pointsCost}</b> 术值兑换 <b className="text-[var(--text)]">{n}</b> credit
                {n > maxByAll && <span className="ml-1 text-[var(--danger)]">· 超出可兑上限 {Math.max(0, maxByAll)}</span>}
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-3 text-sm text-[var(--muted)]">
          术值兑换暂未开放；充值码入口可用。
        </div>
      )}

      {msg && (
        <div className={`text-sm ${msg.type === 'ok' ? 'text-[var(--accent-2)]' : 'text-[var(--danger)]'}`}>
          {msg.text}
        </div>
      )}
      <p className="text-[11px] text-[var(--faint)]">
        提示：术值与 credit 均不可提现、不可转赠，仅用于平台内算力消耗。
      </p>
    </div>
  )
}

function newIdempotencyKey(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  } catch {
    // ignore
  }
  return `exchange:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3">
      <div className="text-lg font-bold" style={{ color: accent }}>
        {value}
      </div>
      <div className="text-xs text-[var(--muted)]">{label}</div>
    </div>
  )
}
