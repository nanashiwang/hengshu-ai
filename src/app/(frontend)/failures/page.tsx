import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { aggregateFailureKnowledge } from '@/lib/failureKnowledge'
import { getPayloadClient } from '@/lib/payload'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '失败知识库 · 衡术 Hengshu',
  description: '基于真实运行回流的模型失败模式摘要：症状、可能原因与修复方向。',
}

function sourceLabel(source: string) {
  return source === 'benchmark'
    ? '系统评测'
    : source === 'online'
      ? '在线'
      : source === 'verified'
        ? '已验证'
        : source === 'community'
          ? '社区'
          : source
}

export default async function FailuresPage() {
  const [payload, user] = await Promise.all([getPayloadClient(), getCurrentUser()])
  const res = await payload.find({
    collection: 'compat-reports',
    depth: 1,
    limit: 2000,
    overrideAccess: true,
    sort: '-createdAt',
  })
  const groups = aggregateFailureKnowledge(res.docs as any[], 60)

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--accent-2)]">Negative Knowledge</p>
        <h1 className="mt-1 text-2xl font-semibold">失败知识库</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
          只聚合错误标签、模型名、输入/输出规模档和 Skill 名称；不公开 prompt、输出原文或逐条时序。
          公开页给症状与根因摘要，登录后显示修复模板和复验步骤。
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center text-[var(--muted)]">
          还没有失败样本。在线运行或 benchmark 出现失败后，这里会自动聚合负知识。
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((g) => (
            <article key={`${g.errorType}-${g.modelName}`} className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[var(--border)] bg-[var(--panel-2)] px-2 py-0.5 text-xs text-[var(--muted)]">
                      {g.meta.layer}
                    </span>
                    <span className="rounded-full border border-[var(--border)] px-2 py-0.5 font-mono text-xs">
                      {g.errorType}
                    </span>
                  </div>
                  <h2 className="mt-2 text-base font-semibold">{g.meta.label}</h2>
                  <p className="mt-1 font-mono text-xs text-[var(--accent)]">{g.modelName}</p>
                </div>
                <div className="text-right text-xs text-[var(--muted)]">
                  <div className="text-lg font-semibold text-[var(--text)]">{g.count}</div>
                  <div>{g.skillCount} 个 Skill</div>
                </div>
              </div>

              <div className="mt-3 space-y-2 text-sm">
                <p>
                  <b>症状：</b>
                  <span className="text-[var(--muted)]">{g.meta.symptom}</span>
                </p>
                <p>
                  <b>可能原因：</b>
                  <span className="text-[var(--muted)]">{g.meta.likelyCause}</span>
                </p>
                <p>
                  <b>公开修复方向：</b>
                  <span className="text-[var(--muted)]">{g.meta.publicFixHint}</span>
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                {g.inputBuckets.length > 0 && <span>输入：{g.inputBuckets.join(' / ')}</span>}
                {g.outputBuckets.length > 0 && <span>输出：{g.outputBuckets.join(' / ')}</span>}
                {Object.entries(g.sourceBreakdown).map(([source, count]) => (
                  <span key={source}>
                    {sourceLabel(source)}×{count}
                  </span>
                ))}
              </div>

              {g.sampleSkills.length > 0 && (
                <div className="mt-3 text-xs text-[var(--muted)]">
                  关联 Skill：
                  {g.sampleSkills.map((s, i) => (
                    <span key={s.id}>
                      {i > 0 ? '、' : ''}
                      {s.slug ? (
                        <Link href={`/skills/${s.slug}`} className="text-[var(--accent)] hover:underline">
                          {s.title}
                        </Link>
                      ) : (
                        s.title
                      )}
                    </span>
                  ))}
                </div>
              )}

              {user ? (
                <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 text-xs">
                  <div>
                    <b>修复模板：</b>
                    <span className="text-[var(--muted)]">{g.meta.repairTemplate}</span>
                  </div>
                  <div className="mt-2">
                    <b>复验：</b>
                    <span className="text-[var(--muted)]">{g.meta.verifyTemplate}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg)] p-3 text-xs text-[var(--muted)]">
                  登录后查看修复模板与复验步骤。
                  <Link href="/login" className="ml-1 text-[var(--accent)]">
                    去登录
                  </Link>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
