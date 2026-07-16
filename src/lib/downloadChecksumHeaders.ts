export function downloadChecksumHeaders(checksum: string | null | undefined): Record<string, string> {
  const value = String(checksum || '')
  return {
    'X-Suyuan-Checksum': value,
  }
}
