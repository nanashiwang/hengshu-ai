const SENSITIVE_PUBLIC_KEYS = new Set([
  'apikey',
  'authorization',
  'bearer',
  'completiontokens',
  'example',
  'exampleinput',
  'exampleoutput',
  'examples',
  'expectedoutput',
  'expectedtext',
  'internalnote',
  'input',
  'inputjson',
  'logid',
  'margin',
  'newapilogid',
  'output',
  'outputjson',
  'outputtext',
  'outputschemapatch',
  'password',
  'passwordhash',
  'adapterpatch',
  'decodingpatch',
  'platformmargin',
  'platformrevenue',
  'prompt',
  'prompttemplate',
  'prompttokens',
  'rawinput',
  'rawoutput',
  'rawprompt',
  'rawreports',
  'sample',
  'sampleinput',
  'sampleoutput',
  'schemapatch',
  'systemprompt',
  'systempromptappend',
  'testinput',
  'testoutput',
  'tokendigest',
  'tokenhash',
  'totaltokens',
  'userpromptappend',
])

const SENSITIVE_PUBLIC_KEY_PARTS = [
  'apikey',
  'authorization',
  'bearer',
  'secret',
  'accesstoken',
  'refreshtoken',
  'newapilog',
  'password',
  'privatekey',
  'signingkey',
  'logid',
  'margin',
  'revenue',
  'tokendigest',
  'tokenhash',
]

function normalizedKey(key: string) {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function isSensitivePublicKey(key: string) {
  const normalized = normalizedKey(key)
  return (
    SENSITIVE_PUBLIC_KEYS.has(normalized) ||
    SENSITIVE_PUBLIC_KEY_PARTS.some((part) => normalized.includes(part))
  )
}

function sanitizePublicString(value: string) {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer <redacted>')
    .replace(/\b(sk|rk|pk|sess|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_=-]{12,}\b/g, '<redacted>')
    .replace(/\b(enc:v\d+:[A-Za-z0-9+/=:_-]{12,})\b/g, '<redacted>')
}

export function publicSanitize<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => publicSanitize(item)) as T
  if (typeof value === 'string') return sanitizePublicString(value) as T
  if (!value || typeof value !== 'object') return value
  const clean: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitivePublicKey(key)) continue
    clean[key] = publicSanitize(child)
  }
  return clean as T
}
