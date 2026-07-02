// New API 中转「管理 API」抽象层（子令牌配额管理）——变现骨架的地基。
//
// 设计前提：权威的 credit 余额存在本平台 `credit-logs`（不变量 creditBalance==SUM(logs)），
// 向 New API 网关同步子令牌配额只是**副作用**。因此：
//   · stub 模式（默认 / 未配置 env）：模拟成功、不发外部请求 → 整个变现闭环本地可跑通，只是不真正下发网关配额；
//   · real 模式（配置了 NEWAPI_ADMIN_BASE_URL + NEWAPI_ADMIN_KEY）：按 QuantumNous/new-api 源码规格调真实接口。
//
// 上线前用你实例小额真跑校验（总纲 §7 B）：鉴权前缀(NEWAPI_AUTH_BEARER)、list/log 响应包裹、log 查询参数名、
// `NEWAPI_CREDIT_TO_QUOTA`（1 credit=多少 quota，按你的售价校准）。

export class NewApiAdminError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'NewApiAdminError'
  }
}

export interface SubToken {
  tokenName: string
  key?: string // 子令牌的 sk- 密钥（真实模式建成后返回，供用户 BYOK / 平台代跑）
  tokenId?: number
  simulated: boolean
}
export interface QuotaResult {
  ok: boolean
  remainQuota?: number
  simulated: boolean
}
export interface UsageResult {
  costCents: number // 该用户自 sinceMs 起的消费(用户到手价，分)；平台毛利=此值-进货成本(进货不在 log，见 §7B)
  calls: number
  simulated: boolean
}

export interface NewApiAdmin {
  readonly mode: 'real' | 'stub'
  /** 为用户建/确保受限子令牌（低价分组 + 配额 + TTL），返回 token_name（约定 hs_<userId>） */
  provisionSubToken(userId: string): Promise<SubToken>
  /** 增/减子令牌配额；deltaCredits 可负（credit→quota 刻度按 CREDIT_TO_QUOTA 映射） */
  adjustQuota(userId: string, deltaCredits: number): Promise<QuotaResult>
  /** 拉取用户自某时刻起的用量与消费（喂护城河 + 毛利对账） */
  fetchUsage(userId: string, sinceMs: number): Promise<UsageResult>
}

const adminBase = () => process.env.NEWAPI_ADMIN_BASE_URL?.replace(/\/$/, '')
const adminKey = () => process.env.NEWAPI_ADMIN_KEY

// credit ↔ 网关 quota 刻度映射：1 credit = 多少 quota。
// 校准：new-api QuotaPerUnit=500000(即 500000 quota=$1)。若 1 credit=¥0.01、你按 ¥Y 卖 500000 quota，
// 则 CREDIT_TO_QUOTA = 0.01/(Y/500000) = 5000/Y。占位默认 700(约 ¥7≈$1 时)，上线前用真实计价校准。
export const CREDIT_TO_QUOTA = Number(process.env.NEWAPI_CREDIT_TO_QUOTA || 700)

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

// ── RealAdmin：按 QuantumNous/new-api 源码规格实现 ──
// 鉴权：Authorization: <access_token>(默认裸值，NEWAPI_AUTH_BEARER=1 加 Bearer 前缀) + New-Api-User: <userId>
// 端点：POST/PUT/GET /api/token/、GET /api/log/。字段名取自源码 model/token.go、model/log.go。
// ⚠️ 上线前用你实例小额真跑校验：鉴权前缀、list/log 响应包裹结构、log 查询参数名。
class RealAdmin implements NewApiAdmin {
  readonly mode = 'real' as const
  private base = adminBase() as string

  private headers(): Record<string, string> {
    const key = process.env.NEWAPI_ADMIN_KEY || ''
    const auth = process.env.NEWAPI_AUTH_BEARER === '1' ? `Bearer ${key}` : key
    return {
      'Content-Type': 'application/json',
      Authorization: auth,
      'New-Api-User': process.env.NEWAPI_ADMIN_USER_ID || '',
    }
  }

  private async req(path: string, method: string, body?: unknown): Promise<any> {
    if (!process.env.NEWAPI_ADMIN_USER_ID) {
      throw new NewApiAdminError('缺少 NEWAPI_ADMIN_USER_ID（New-Api-User 头需要平台账号数字 ID）')
    }
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: this.headers(),
      ...(body != null ? { body: JSON.stringify(body) } : {}),
    })
    const text = await res.text().catch(() => '')
    let json: any = {}
    try {
      json = text ? JSON.parse(text) : {}
    } catch {
      throw new NewApiAdminError(`New API 返回非 JSON（${res.status}）: ${text.slice(0, 200)}`)
    }
    if (!res.ok || json?.success === false) {
      throw new NewApiAdminError(`New API ${method} ${path} 失败(${res.status}): ${json?.message || text.slice(0, 200)}`)
    }
    return json
  }

  // 列表响应包裹结构在不同版本间有差异，容错提取记录数组
  private records(json: any): any[] {
    const d = json?.data ?? json
    if (Array.isArray(d)) return d
    return d?.items || d?.records || d?.list || []
  }

  private async findTokenByName(name: string): Promise<any | null> {
    // 分页扫描本账号令牌找同名（子令牌都在平台账号下）；封顶 50 页防失控
    for (let p = 1; p <= 50; p++) {
      const json = await this.req(`/api/token/?p=${p}&page_size=100`, 'GET')
      const recs = this.records(json)
      const hit = recs.find((t: any) => t?.name === name)
      if (hit) return hit
      if (recs.length < 100) break
    }
    return null
  }

  async provisionSubToken(userId: string): Promise<SubToken> {
    const name = subTokenName(userId)
    const existing = await this.findTokenByName(name)
    if (existing) {
      return { tokenName: name, key: existing.key, tokenId: existing.id, simulated: false }
    }
    await this.req('/api/token/', 'POST', {
      name,
      remain_quota: 0,
      unlimited_quota: false,
      expired_time: -1, // 永不过期
      group: process.env.NEWAPI_SUB_GROUP || '',
      model_limits_enabled: false,
      model_limits: '',
    })
    const created = await this.findTokenByName(name)
    return { tokenName: name, key: created?.key, tokenId: created?.id, simulated: false }
  }

  async adjustQuota(userId: string, deltaCredits: number): Promise<QuotaResult> {
    const name = subTokenName(userId)
    const tok = await this.findTokenByName(name)
    if (!tok) throw new NewApiAdminError(`子令牌 ${name} 不存在，请先 provisionSubToken`)
    const deltaQuota = Math.round(deltaCredits * CREDIT_TO_QUOTA)
    const newRemain = Math.max(0, (tok.remain_quota || 0) + deltaQuota)
    // PUT 传完整令牌对象 + 改后的 remain_quota（绝对值）
    await this.req('/api/token/', 'PUT', { ...tok, remain_quota: newRemain })
    return { ok: true, remainQuota: newRemain, simulated: false }
  }

  async fetchUsage(userId: string, sinceMs: number): Promise<UsageResult> {
    const start = Math.floor(sinceMs / 1000)
    // type=2 消费；按子令牌名过滤；起始时间戳(秒)
    const json = await this.req(
      `/api/log/?type=2&token_name=${encodeURIComponent(subTokenName(userId))}&start_timestamp=${start}&p=1&page_size=1000`,
      'GET',
    )
    const recs = this.records(json)
    const totalQuota = recs.reduce((s: number, r: any) => s + (r?.quota || 0), 0)
    // quota → 分：与 credit 同刻度反向映射（1 credit=1 分=CREDIT_TO_QUOTA quota）
    const costCents = CREDIT_TO_QUOTA > 0 ? Math.round(totalQuota / CREDIT_TO_QUOTA) : 0
    return { costCents, calls: recs.length, simulated: false }
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
