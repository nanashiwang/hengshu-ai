import YAML from 'yaml'

// 构造可移植的 Skill manifest（产品文档 §10.2），用户下载后可用本地 Runner / 自有模型运行。
export function buildManifest(
  skill: any,
  version: any,
  opts: { siteUrl?: string; exportedAt?: string } = {},
) {
  const author = typeof skill.author === 'object' ? skill.author?.username : undefined
  const category = typeof skill.category === 'object' ? skill.category?.slug : undefined
  return {
    spec_version: 1,
    id: skill.slug,
    slug: skill.slug,
    name: skill.title,
    version: version?.version || '1.0.0',
    description: skill.description || '',
    author: author || 'official',
    category: category || 'general',
    input_schema: version?.inputSchema || {},
    prompt_template: version?.promptTemplate || '',
    output_schema: version?.outputSchema || {},
    recommended_models: version?.recommendedModels || { cloud: [], local: [] },
    route_policy: version?.routePolicy || {},
    source: 'hengshu',
    skill_url: opts.siteUrl ? `${opts.siteUrl}/skills/${skill.slug}` : undefined,
    exported_at: opts.exportedAt,
  }
}

export function manifestToYaml(m: any): string {
  return YAML.stringify(m, { lineWidth: 0 })
}

export function manifestToJson(m: any): string {
  return JSON.stringify(m, null, 2)
}
