export type LimitedJsonResult =
  | { ok: true; value: any }
  | { ok: false; status: 400 | 413; error: string }

export async function readJsonBodyWithLimit(
  request: Request,
  maxBytes: number,
  tooLargeError = '请求体过大',
  options: { emptyValue?: any } = {},
): Promise<LimitedJsonResult> {
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { ok: false, status: 413, error: tooLargeError }
  }

  let raw = ''
  try {
    raw = await request.text()
  } catch {
    return { ok: false, status: 400, error: '请求体无效' }
  }

  if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
    return { ok: false, status: 413, error: tooLargeError }
  }
  if (!raw.trim() && Object.prototype.hasOwnProperty.call(options, 'emptyValue')) {
    return { ok: true, value: options.emptyValue }
  }

  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch {
    return { ok: false, status: 400, error: '请求体无效' }
  }
}
