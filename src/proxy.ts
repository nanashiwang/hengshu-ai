import { NextRequest, NextResponse } from 'next/server'

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function normalizeOrigin(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.host}`
  } catch {
    return null
  }
}

function requestHostOrigin(request: NextRequest): string {
  const host = request.headers.get('host') || request.nextUrl.host
  const proto = (request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '') || 'http')
    .split(',')[0]
    .trim()
  return `${proto}://${host}`
}

export function proxy(request: NextRequest) {
  if (MUTATING.has(request.method)) {
    const origin = normalizeOrigin(request.headers.get('origin'))
    const fetchSite = request.headers.get('sec-fetch-site')
    const allowedOrigins = new Set(
      [
        requestHostOrigin(request),
        request.nextUrl.origin,
        process.env.NEXT_PUBLIC_SERVER_URL ? new URL(process.env.NEXT_PUBLIC_SERVER_URL).origin : null,
      ]
        .map(normalizeOrigin)
        .filter(Boolean),
    )

    // 有 Origin/Fetch Metadata 时强制同源；无 Origin 的 Runner/CLI/Bearer 请求不误伤。
    if (origin && !allowedOrigins.has(origin)) {
      return NextResponse.json({ error: '跨站请求已拒绝' }, { status: 403 })
    }
    if (fetchSite === 'cross-site') {
      return NextResponse.json({ error: '跨站请求已拒绝' }, { status: 403 })
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/v1/:path*'],
}
