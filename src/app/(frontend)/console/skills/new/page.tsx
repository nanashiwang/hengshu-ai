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
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 text-lg font-semibold">发布 Skill</h1>
        <p className="text-sm text-[var(--muted)]">
          填写基础信息并上传标准 Skill 包。AI 审核低风险包后会自动上架；不确定风险转人工审核。
        </p>
      </div>
      <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
        <div className="grid gap-3 text-sm md:grid-cols-4">
          <div>
            <div className="font-medium">1. 上传包</div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              推荐带 manifest、输入输出 schema、示例和权限声明。
            </p>
          </div>
          <div>
            <div className="font-medium">2. 生成 Contract</div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              平台冻结能力边界，用于后续达标证书和版本变更判断。
            </p>
          </div>
          <div>
            <div className="font-medium">3. 刷新 Passport</div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              发布后汇总身份、签名、兼容、失败和证据状态。
            </p>
          </div>
          <div>
            <div className="font-medium">4. 适配维护</div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              后续从失败库生成 Adapter 草稿，持续修复模型差异。
            </p>
          </div>
        </div>
      </section>
      <SkillForm categories={categories} />
    </div>
  )
}
