import { evidenceHash } from './evidenceHash'
import { publicSanitize } from './publicSanitize'
import { skillContractHash } from './skillContract'

function relationId(value: any): string | null {
  if (!value) return null
  return typeof value === 'object' ? String(value.id || '') || null : String(value)
}

export function publicRoutePolicy(routePolicy: any) {
  if (!routePolicy || typeof routePolicy !== 'object' || Array.isArray(routePolicy)) return null
  const { dataDriven: _dataDriven, ...rest } = routePolicy
  return publicSanitize(rest)
}

export type PublicSkillContractOptions = {
  slug?: string | null
}

function contractReviewPlaybook(version: any, opts: PublicSkillContractOptions = {}) {
  const slug = opts.slug ? String(opts.slug) : ''
  const status = String(version?.contractStatus || 'initial')
  const decision =
    status === 'breaking_change'
      ? 'review_before_upgrade'
      : status === 'compatible_change'
        ? 'safe_to_trial'
        : 'baseline'

  return {
    customerValue:
      '把 Skill 从一段 Prompt 变成可复核能力契约：先看输入/输出、权限和最低 Runner，再用 hash 判断版本升级是否会破坏现有流程。',
    decision,
    reviewChecklist: [
      '输入 schema 是否覆盖你的真实任务字段',
      '输出 schema 是否适合自动解析或进入后续工作流',
      '权限与最低 Runner 版本是否符合个人或企业环境',
      'contractHash / promptHash 是否与上次准入记录一致',
    ],
    nextActions: [
      {
        label: '核对契约 Hash',
        description: '用 contractHash 固定输入、输出、权限、推荐模型和 Runner 边界；prompt 正文不公开，只公开 hash 供复核。',
        href: slug ? `/v1/skills/${encodeURIComponent(slug)}/contract` : null,
      },
      {
        label: '检查破坏性变更',
        description:
          status === 'breaking_change'
            ? '本版本改动了 schema、权限或最低 Runner，升级前应先试跑并更新企业准入记录。'
            : '当前未标记破坏性变更，但仍应检查 schema 与权限是否符合你的流程。',
        href: null,
      },
      {
        label: '验签达标证书',
        description: '证书会绑定 Contract、Passport 与黄金样例结果，适合采购、企业 Registry 或上线前复核。',
        href: slug
          ? `/verify?certificateUrl=${encodeURIComponent(`/v1/skills/${encodeURIComponent(slug)}/certificate`)}`
          : null,
      },
      {
        label: '试跑或重跑',
        description: '用默认输入在线试跑，或从私人台账换模型重跑，确认契约在你的模型/网关里仍可用。',
        href: slug ? `/skills/${encodeURIComponent(slug)}/run` : null,
      },
    ],
  }
}

export function publicSkillContract(version: any, opts: PublicSkillContractOptions = {}) {
  return {
    id: String(version?.id || ''),
    skill: relationId(version?.skill),
    version: version?.version || null,
    contractHash: version?.contractHash || skillContractHash(version),
    contractStatus: version?.contractStatus || 'initial',
    systemPromptHash: evidenceHash(version?.systemPrompt || ''),
    promptTemplateHash: evidenceHash(version?.promptTemplate || ''),
    inputSchema: publicSanitize(version?.inputSchema || null),
    outputSchema: publicSanitize(version?.outputSchema || null),
    recommendedModels: publicSanitize(version?.recommendedModels || null),
    routePolicy: publicRoutePolicy(version?.routePolicy || null),
    permissions: publicSanitize(version?.permissions || null),
    minRunnerVersion: version?.minRunnerVersion || null,
    examplesCount: Array.isArray(version?.examples) ? version.examples.length : 0,
    changelogHash: version?.changelog ? evidenceHash(version.changelog) : null,
    updatedAt: version?.updatedAt || null,
    playbook: contractReviewPlaybook(version, opts),
  }
}
