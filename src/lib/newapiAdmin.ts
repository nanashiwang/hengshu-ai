// New API 中转「管理 API」抽象层（子令牌配额管理）——变现骨架的地基。
//
// 设计前提：权威的 credit 余额存在本平台 `credit-logs`（不变量 creditBalance==SUM(logs)），
// 向 New API 网关同步子令牌配额只是**副作用**。因此：
//   · stub 模式（默认 / 未配置 env）：模拟成功、不发外部请求 → 整个变现闭环本地可跑通，只是不真正下发网关配额；
//   · real 模式（配置了 NEWAPI_ADMIN_BASE_URL + NEWAPI_ADMIN_KEY）：在作者提供一次「建令牌/看日志」的真实
//     curl（方法+URL+JSON）之前，方法抛 NotImplemented，避免用错误猜测的接口静默写坏网关。
//
// 待作者拍板（总纲 §7 B）：真实 curl 形态 + `NEWAPI_CREDIT_TO_QUOTA`（1 credit=多少网关 quota 刻度）。

export class NewApiAdminError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'NewApiAdminError'
  }
}

export interface SubToken {
  tokenName: string
  simulated: boolean
}
export interface QuotaResult {
  ok: boolean
  simulated: boolean
}
export interface UsageResult {
  costCents: number // 该用户自 sinceMs 起的到手成本（分）——毛利回流用
  calls: number
  simulated: boolean
}

export interface NewApiAdmin {
  readonly mode: 'real' | 'stub'
  /** 为用户建/确保受限子令牌（低价分组 + 配额 + TTL），返回 token_name（约定 hs_<userId>） */
  provisionSubToken(userId: string): Promise<SubToken>
  /** 增/减子令牌配额；deltaCredits 可负（credit→quota 刻度按 CREDIT_TO_QUOTA 映射） */
  adjustQuota(userId: string, deltaCredits: number): Promise<QuotaResult>
  /** 拉取用户自某时刻起的用量与到手成本（喂护城河 + 毛利对账） */
  fetchUsage(userId: string, sinceMs: number): Promise<UsageResult>
}

const adminBase = () => process.env.NEWAPI_ADMIN_BASE_URL?.replace(/\/$/, '')
const adminKey = () => process.env.NEWAPI_ADMIN_KEY

// credit ↔ 网关 quota 刻度映射（占位 1:1，待作者用真实 quota 刻度校准）
export const CREDIT_TO_QUOTA = Number(process.env.NEWAPI_CREDIT_TO_QUOTA || 1)

export function isRealMode(): boolean {
  return !!(adminBase() && adminKey())
}

// 令牌命名约定：1 个 New API 账号 = 全体用户，靠子令牌名隔离
export function subTokenName(userId: string): string {
  return `hs_${userId}`
}

class StubAdmin implements NewApiAdmin {
  readonly mode = 'stub' as const
  async provisionSubToken(userId: string): Promise<SubToken> {
    return { tokenName: subTokenName(userId), simulated: true }
  }
  async adjustQuota(_userId: string, _deltaCredits: number): Promise<QuotaResult> {
    return { ok: true, simulated: true }
  }
  async fetchUsage(_userId: string, _sinceMs: number): Promise<UsageResult> {
    return { costCents: 0, calls: 0, simulated: true }
  }
}

class RealAdmin implements NewApiAdmin {
  readonly mode = 'real' as const
  private notReady(): never {
    throw new NewApiAdminError(
      'New API 管理 API 尚未接入：请提供后台「建令牌 / 看日志」的真实 curl（方法+URL+JSON），以填充 src/lib/newapiAdmin.ts 的 RealAdmin。',
    )
  }
  async provisionSubToken(_userId: string): Promise<SubToken> {
    // TODO(curl)：POST {base}/api/token  body {name, remain_quota, expired_time, group, model_limits...}
    return this.notReady()
  }
  async adjustQuota(_userId: string, _deltaCredits: number): Promise<QuotaResult> {
    // TODO(curl)：PUT {base}/api/token  更新 remain_quota（+= deltaCredits*CREDIT_TO_QUOTA）
    return this.notReady()
  }
  async fetchUsage(_userId: string, _sinceMs: number): Promise<UsageResult> {
    // TODO(curl)：GET {base}/api/log?...  聚合单用户消费明细 + 进货成本
    return this.notReady()
  }
}

// 工厂（不缓存，供测试按 env 切换）
export function createNewApiAdmin(): NewApiAdmin {
  return isRealMode() ? new RealAdmin() : new StubAdmin()
}

let _inst: NewApiAdmin | null = null
export function getNewApiAdmin(): NewApiAdmin {
  return (_inst ??= createNewApiAdmin())
}
