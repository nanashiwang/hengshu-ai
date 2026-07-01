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
        填写下面几段即可发布一个 Skill（结构化的参数化 prompt）。提交后进入待审核。
      </p>
      <SkillForm categories={categories} />
    </div>
  )
}
