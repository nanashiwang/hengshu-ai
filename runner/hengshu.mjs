#!/usr/bin/env node
/**
 * 衡术 Hengshu —— 本地 Skill Runner CLI
 *
 * 子命令：
 *   hengshu login [--hub <url>]                设备码登录，令牌存 ~/.hengshu/config.json
 *   hengshu whoami                             验证登录归属
 *   hengshu run <manifest|slug> [选项]          用本地/自有模型运行 Skill
 *
 * run 选项：
 *   --endpoint <url>   OpenAI 兼容 endpoint（默认 http://localhost:11434/v1，即 Ollama）
 *   --model <name>     模型名（默认取 manifest 的 local 推荐）
 *   --key <key>        endpoint 的 Key（本地模型一般留空）
 *   --hub <url>        传入 slug 时从 Hub 拉取 manifest（默认 config.hub 或 http://localhost:3000）
 *   --in <key=value>   预填输入字段（可重复）
 *   --raw              只输出模型原文
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const RUNNER_VERSION = '0.2.0'
const HOME = path.join(os.homedir(), '.hengshu')
const CONFIG_PATH = path.join(HOME, 'config.json')
const DEFAULT_HUB = 'http://localhost:3000'

// ───────── config ─────────
function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
  } catch {
    return {}
  }
}
function writeConfig(cfg) {
  fs.mkdirSync(HOME, { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2))
  try {
    fs.chmodSync(CONFIG_PATH, 0o600)
  } catch {
    /* windows 无 chmod */
  }
}

function parseArgs(argv) {
  const a = { _: [], in: {} }
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (t === '--in') {
      const kv = argv[++i] || ''
      const eq = kv.indexOf('=')
      if (eq > 0) a.in[kv.slice(0, eq)] = kv.slice(eq + 1)
    } else if (t.startsWith('--')) {
      const k = t.slice(2)
      if (k === 'raw') a.raw = true
      else a[k] = argv[++i]
    } else {
      a._.push(t)
    }
  }
  return a
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ───────── login ─────────
async function cmdLogin(args) {
  const cfg = readConfig()
  const hub = (args.hub || cfg.hub || DEFAULT_HUB).replace(/\/$/, '')

  const codeRes = await fetch(`${hub}/v1/auth/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runnerVersion: RUNNER_VERSION, os: process.platform, arch: process.arch }),
  })
  if (!codeRes.ok) throw new Error(`申请设备码失败（${codeRes.status}）`)
  const code = await codeRes.json()

  console.log('\n请在浏览器打开以下地址，并输入设备码完成授权：\n')
  console.log(`   地址：${code.verification_uri}?code=${encodeURIComponent(code.user_code)}`)
  console.log(`   设备码：${code.user_code}\n`)
  console.log('等待授权中…（完成后本终端会自动继续）')

  const interval = (code.interval || 3) * 1000
  const deadline = Date.now() + (code.expires_in || 600) * 1000
  while (Date.now() < deadline) {
    await sleep(interval)
    const tRes = await fetch(`${hub}/v1/auth/device/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_code: code.device_code }),
    })
    if (tRes.status === 202) continue // authorization_pending
    const data = await tRes.json().catch(() => ({}))
    if (tRes.ok && data.access_token) {
      writeConfig({ hub, token: data.access_token, runnerId: data.runner_id })
      console.log(`\n✅ 登录成功，令牌已保存到 ${CONFIG_PATH}`)
      return
    }
    if (data.error && data.error !== 'authorization_pending') {
      throw new Error(`登录失败：${data.error}`)
    }
  }
  throw new Error('设备码已过期，请重新 hengshu login')
}

// ───────── whoami ─────────
async function cmdWhoami(args) {
  const cfg = readConfig()
  if (!cfg.token) throw new Error('尚未登录，请先 hengshu login')
  const hub = (args.hub || cfg.hub || DEFAULT_HUB).replace(/\/$/, '')
  const res = await fetch(`${hub}/v1/runner/me`, { headers: { Authorization: `Bearer ${cfg.token}` } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || '令牌无效，请重新登录')
  console.log(`用户：${data.user?.username}  ·  Runner：${data.runnerId}  ·  信任级别：${data.trustedLevel}`)
}

// ───────── run ─────────
async function loadManifest(ref, hub) {
  if (fs.existsSync(ref)) {
    const text = fs.readFileSync(ref, 'utf8')
    if (ref.endsWith('.yaml') || ref.endsWith('.yml')) {
      const YAML = (await import('yaml')).default
      return YAML.parse(text)
    }
    return JSON.parse(text)
  }
  const base = (hub || DEFAULT_HUB).replace(/\/$/, '')
  const res = await fetch(`${base}/v1/skills/${ref}/manifest?format=json`)
  if (!res.ok) throw new Error(`无法从 Hub 拉取 Skill：${ref}（${res.status}）`)
  return res.json()
}

function render(template, vars) {
  return (template || '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_m, k) => {
    const v = vars[k]
    return v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v)
  })
}

async function collectInputs(schema, preset) {
  const vars = { ...preset }
  const rl = readline.createInterface({ input, output })
  try {
    for (const [key, def] of Object.entries(schema || {})) {
      if (vars[key] != null && vars[key] !== '') continue
      const label = (def && def.label) || key
      const req = def && def.required ? '（必填）' : '（可选，回车跳过）'
      const opts =
        def && def.options
          ? `[${def.options.map((o) => (typeof o === 'string' ? o : o.value || o.label)).join('/')}] `
          : ''
      const ans = (await rl.question(`· ${label}${req} ${opts}`)).trim()
      if (ans) vars[key] = ans
      else if (def && def.required) {
        console.error(`缺少必填字段：${label}`)
        process.exit(1)
      }
    }
  } finally {
    rl.close()
  }
  return vars
}

async function cmdRun(args) {
  const cfg = readConfig()
  const ref = args._[0]
  if (!ref) throw new Error('用法：hengshu run <manifest 文件 | skill-slug> [选项]')

  const manifest = await loadManifest(ref, args.hub || cfg.hub)
  const endpoint = (args.endpoint || 'http://localhost:11434/v1').replace(/\/$/, '')
  const model =
    args.model ||
    manifest.models?.local_recommended?.[0] ||
    manifest.recommended_models?.local?.[0] ||
    manifest.recommended_models?.cloud?.[0]
  if (!model) throw new Error('未指定模型，且 manifest 无推荐模型。请用 --model 指定。')

  if (!args.raw) {
    console.log(`\n▸ Skill：${manifest.name}  (v${manifest.version})`)
    console.log(`▸ 模型：${model}  @  ${endpoint}\n`)
  }

  const vars = await collectInputs(manifest.input_schema, args.in)
  const userTemplate = manifest.prompt?.user_template ?? manifest.prompt_template ?? ''
  const systemTemplate = manifest.prompt?.system ?? ''
  const messages = [
    ...(render(systemTemplate, vars) ? [{ role: 'system', content: render(systemTemplate, vars) }] : []),
    { role: 'user', content: render(userTemplate, vars) },
  ]

  const start = Date.now()
  const res = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(args.key ? { Authorization: `Bearer ${args.key}` } : {}) },
    body: JSON.stringify({ model, messages }),
  })
  const latency = Date.now() - start
  if (!res.ok) throw new Error(`模型调用失败（${res.status}）：${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content ?? ''

  if (args.raw) {
    console.log(text)
  } else {
    console.log('—'.repeat(48))
    console.log(text)
    console.log('—'.repeat(48))
    const u = data.usage || {}
    console.log(`⏱  ${latency}ms   tokens: ${u.total_tokens ?? '?'}   （本地/自有算力，未经中央服务器）`)
  }
}

// ───────── main ─────────
async function main() {
  const argv = process.argv.slice(2)
  const cmd = argv[0]
  const args = parseArgs(argv.slice(1))
  switch (cmd) {
    case 'login':
      return cmdLogin(args)
    case 'whoami':
      return cmdWhoami(args)
    case 'run':
      return cmdRun(args)
    default:
      console.log('用法：hengshu <login|whoami|run> [选项]')
      console.log('  hengshu login                登录（设备码）')
      console.log('  hengshu whoami               查看登录归属')
      console.log('  hengshu run <slug|file>      运行 Skill')
      process.exit(cmd ? 1 : 0)
  }
}

main().catch((e) => {
  console.error('错误：', e.message)
  process.exit(1)
})
