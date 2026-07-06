import { getPayloadClient } from '@/lib/payload'
import { SkillForm } from '@/components/SkillForm'

export const dynamic = 'force-dynamic'

// 创作者发布 Skill 页（在已鉴权的 /console 域内；console/layout 已做登录门禁）
export default async function NewSkillPage() {
  const payload = await getPayloadClient()
  const cats = await payload.find({
    collection: 'categories',
    limit: 100,
    sort: 'order',
    overrideAccess: true,
  })
  const categories = cats.docs.map((c: any) => ({ slug: c.slug as string, name: c.name as string }))

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold">发布 Skill</h1>
      <p className="mb-4 text-sm text-[var(--muted)]">
        填写基础信息并上传标准 Skill 包。AI 审核低风险包后会自动上架；不确定风险转人工审核。
      </p>
      <SkillForm categories={categories} />
    </div>
  )
}
