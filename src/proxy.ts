import { NextRequest, NextResponse } from 'next/server'

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function proxy(request: NextRequest) {
  if (MUTATING.has(request.method)) {
    const origin = request.headers.get('origin')
    const fetchSite = request.headers.get('sec-fetch-site')
    const selfOrigin = request.nextUrl.origin
    const publicOrigin = process.env.NEXT_PUBLIC_SERVER_URL
      ? new URL(process.env.NEXT_PUBLIC_SERVER_URL).origin
      : selfOrigin

    // 有 Origin/Fetch Metadata 时强制同源；无 Origin 的 Runner/CLI/Bearer 请求不误伤。
    if (origin && origin !== selfOrigin && origin !== publicOrigin) {
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
