import { readEnterpriseOptionalQuery } from '@/lib/enterpriseRequest'
import { verifyEnterpriseSsoState } from '@/lib/enterprise'

// GET /v1/enterprise/identity/callback —— OIDC 回调占位：先接住 code/state，后续接 token exchange 与成员绑定。
export async function GET(request: Request) {
  const url = new URL(request.url)
  const codeParam = readEnterpriseOptionalQuery(url.searchParams, 'code', 4000)
  if (typeof codeParam !== 'string') return Response.json({ ok: false, error: codeParam.error }, { status: codeParam.status })
  const stateParam = readEnterpriseOptionalQuery(url.searchParams, 'state', 500)
  if (typeof stateParam !== 'string') return Response.json({ ok: false, error: stateParam.error }, { status: stateParam.status })
  const errorParam = readEnterpriseOptionalQuery(url.searchParams, 'error', 200)
  if (typeof errorParam !== 'string') return Response.json({ ok: false, error: errorParam.error }, { status: errorParam.status })
  const errorDescriptionParam = readEnterpriseOptionalQuery(url.searchParams, 'error_description', 1000)
  if (typeof errorDescriptionParam !== 'string') return Response.json({ ok: false, error: errorDescriptionParam.error }, { status: errorDescriptionParam.status })
  const code = codeParam
  const state = stateParam
  const error = errorParam
  if (error) return Response.json({ ok: false, error, errorDescription: errorDescriptionParam || null }, { status: 400 })
  if (!code || !state) return Response.json({ ok: false, error: '缺少 OIDC code 或 state' }, { status: 400 })
  const stateCheck = verifyEnterpriseSsoState(state)
  if (!stateCheck.ok) return Response.json({ ok: false, error: stateCheck.reason }, { status: 400 })
  return Response.json({
    ok: false,
    status: 'callback_received',
    codeReceived: true,
    stateReceived: true,
    organizationId: stateCheck.payload.organizationId,
    redirectPath: stateCheck.payload.redirectPath,
    nonceReceived: Boolean(stateCheck.payload.nonce),
    next: '已完成 state 签名校验并还原组织上下文；后续在这里完成 code 换 token、ID Token/nonce 校验、邮箱域白名单校验和组织成员绑定。',
  }, { status: 501 })
}
