import { getPayload } from 'payload'
import config from '@payload-config'
import { loginIdentifierKind, normalizeLoginIdentifier } from '@/lib/loginIdentifier'

function payloadErrorMessage(data: any): string {
  return data?.errors?.[0]?.message || data?.message || data?.error || '登录失败'
}

function responseWithForwardedCookies(body: string, status: number, sourceHeaders: Headers): Response {
  const headers = new Headers({ 'Content-Type': sourceHeaders.get('content-type') || 'application/json' })
  const cookies =
    typeof (sourceHeaders as any).getSetCookie === 'function'
      ? (sourceHeaders as any).getSetCookie()
      : sourceHeaders.get('set-cookie')
        ? [sourceHeaders.get('set-cookie') as string]
        : []
  for (const cookie of cookies) headers.append('Set-Cookie', cookie)
  return new Response(body, { status, headers })
}

// POST /v1/auth/login —— 邮箱/用户名均可登录；最终仍委托 Payload auth 生成会话 cookie。
export async function POST(request: Request) {
  let body: any = {}
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: '请求体无效' }, { status: 400 })
  }

  const identifier = normalizeLoginIdentifier(body.identifier ?? body.email ?? body.username)
  const password = typeof body.password === 'string' ? body.password : ''
  if (!identifier || !password) return Response.json({ error: '账号和密码均为必填' }, { status: 400 })

  let email = identifier
  if (loginIdentifierKind(identifier) === 'username') {
    const payload = await getPayload({ config })
    const users = await payload.find({
      collection: 'users',
      where: { username: { equals: identifier } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const user = users.docs[0] as any
    if (!user?.email) return Response.json({ error: '账号或密码错误' }, { status: 401 })
    email = user.email
  }

  const origin = new URL(request.url).origin
  const loginRes = await fetch(`${origin}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const text = await loginRes.text()
  if (!loginRes.ok) {
    let data: any = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      /* ignore */
    }
    return Response.json({ error: payloadErrorMessage(data) }, { status: loginRes.status })
  }
  return responseWithForwardedCookies(text, loginRes.status, loginRes.headers)
}
