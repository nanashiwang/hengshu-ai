import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'
import { SKILL_CATEGORIES } from '../lib/constants'
import { SEED_SKILLS } from './skills'

const ADMIN_EMAIL = 'admin@yuanheng.ai'
const ADMIN_PASSWORD = 'admin12345'

async function seed() {
  const payload = await getPayload({ config })
  payload.logger.info('开始注入种子数据…')

  // ── 管理员 ──
  let admin = (
    await payload.find({
      collection: 'users',
      where: { email: { equals: ADMIN_EMAIL } },
      limit: 1,
      overrideAccess: true,
    })
  ).docs[0]
  if (!admin) {
    admin = await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        email: ADMIN_EMAIL,
        username: 'admin',
        password: ADMIN_PASSWORD,
        role: 'admin',
        level: 99,
        inviteCount: 10,
      },
    })
    payload.logger.info(`✓ 管理员已创建：${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
  } else {
    payload.logger.info('· 管理员已存在，跳过')
  }

  // ── 分类 ──
  const catMap: Record<string, string> = {}
  for (const c of SKILL_CATEGORIES) {
    let cat = (
      await payload.find({
        collection: 'categories',
        where: { slug: { equals: c.slug } },
        limit: 1,
        overrideAccess: true,
      })
    ).docs[0]
    if (!cat) {
      cat = await payload.create({
        collection: 'categories',
        overrideAccess: true,
        data: { name: c.name, slug: c.slug, icon: c.icon },
      })
    }
    catMap[c.slug] = cat.id as string
  }
  payload.logger.info(`✓ 分类就绪（${Object.keys(catMap).length} 个）`)

  // ── 官方 Skill ──
  for (const s of SEED_SKILLS) {
    const exists = (
      await payload.find({
        collection: 'skills',
        where: { slug: { equals: s.slug } },
        limit: 1,
        overrideAccess: true,
      })
    ).docs[0]
    if (exists) {
      payload.logger.info(`· 跳过已存在 Skill：${s.slug}`)
      continue
    }
    const skill = await payload.create({
      collection: 'skills',
      overrideAccess: true,
      data: {
        title: s.title,
        slug: s.slug,
        description: s.description,
        category: catMap[s.category],
        author: admin.id,
        visibility: 'public',
        status: 'published',
        isOfficial: true,
        isFeatured: !!s.featured,
      },
    })
    const version = await payload.create({
      collection: 'skill-versions',
      overrideAccess: true,
      data: {
        skill: skill.id,
        version: '1.0.0',
        status: 'active',
        createdBy: admin.id,
        promptTemplate: s.promptTemplate,
        inputSchema: s.inputSchema,
        outputSchema: s.outputSchema,
        recommendedModels: s.recommendedModels,
        routePolicy: s.routePolicy,
        changelog: '初始版本',
      },
    })
    await payload.update({
      collection: 'skills',
      id: skill.id,
      overrideAccess: true,
      data: { currentVersion: version.id },
    })
    payload.logger.info(`✓ Skill 已创建：${s.title}`)
  }

  // ── 测试邀请码 ──
  let invite = (
    await payload.find({
      collection: 'invite-codes',
      where: { code: { equals: 'WELCOME1' } },
      limit: 1,
      overrideAccess: true,
    })
  ).docs[0]
  if (!invite) {
    invite = await payload.create({
      collection: 'invite-codes',
      overrideAccess: true,
      data: { code: 'WELCOME1', inviter: admin.id, status: 'unused' },
    })
    payload.logger.info('✓ 测试邀请码：WELCOME1')
  }

  payload.logger.info('种子完成 ✅')
  process.exit(0)
}

seed().catch((e) => {
  console.error('种子失败：', e)
  process.exit(1)
})
