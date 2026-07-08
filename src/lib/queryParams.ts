export function boundedIntParam(
  params: URLSearchParams,
  key: string,
  defaultValue: number,
  min: number,
  max: number,
): number {
  const raw = params.get(key)
  if (raw == null || raw.trim() === '') return defaultValue
  const value = Number(raw)
  if (!Number.isFinite(value)) return defaultValue
  return Math.min(Math.max(Math.floor(value), min), max)
}

export function boundedStringParam(params: URLSearchParams, key: string, maxLength: number): string {
  const value = params.get(key)?.trim() || ''
  return value.length > maxLength ? value.slice(0, maxLength) : value
}
