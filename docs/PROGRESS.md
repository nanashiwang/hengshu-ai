# 衡术 Hengshu — 项目进度与规划

> Verified AI Skills, Powered by Contribution.
> 文档更新：2026-06-26 · 版本：v0.1（MVP）· 仓库：https://github.com/nanashiwang/hengshu-ai

---

## 1. 一句话现状

衡术 Hengshu 的 MVP 已端到端跑通，并完成一次关键的**架构方向调整**：从「中央服务器代跑」转向「**分发可下载的 Skill 能力包，用户用自己的算力运行**」。

- 用户可：浏览市场 → 在线试用 / **下载 Skill** → 用本地 Runner / 自有模型运行 → 多模型对比 → 收藏/评论/邀请/悬赏
- 已接入真实模型网关、支持浅/深主题、后台分组、容器化部署

---

## 2. 架构方向：下载优先（分发 + 自带算力）★

**核心判断**：把每次运行的算力都压在中央服务器，既贵又不扩展。正确定位是——**中央只做「发现 / 评测 / 分发 / 社区」，运行算力下沉到用户侧**。这契合产品文档的「AI 能力分发网络」定位与 PT 站「下载种子」隐喻。

### 三种运行方式的定位

| 方式 | 算力位置 | 定位 |
|---|---|---|
| 在线试用（云端运行） | 中央服务器 | 仅「尝一口」，需加配额/限流，**非主力** |
| 下载 + 本地 Runner | 用户本地 | **主力**：自有模型，数据不出本地 |
| 下载 + 自有网关 | 用户的网关 Key | 开发者：成本自担 |

### 职责边界（调整后）

```
中央服务器（衡术）         用户侧
──────────────────       ──────────────
发现 / 搜索 / 分类          下载 manifest（轻量）
SkillRank / 评测            ↓
社区 / 贡献值 / 悬赏        本地 Runner / 自有网关
分发 manifest（YAML/JSON）  ↓
（可选）在线试用·限流       本地模型（Ollama/LM Studio/vLLM…）运行
兼容报告聚合 ← ── 匿名回流 ── 运行结果（算力在用户侧）
```

> 中央**不再为每次运行买单**；只在用户主动选择「在线试用」时承担少量、可限流的算力。

---

## 3. 技术栈与架构

| 层 | 选型 | 职责 |
|---|---|---|
| 前台 + API | **Next.js 16.2.6**（App Router, standalone） | 页面、RSC、自定义 `/v1` 端点 |
| 基座 | **Payload CMS 3.85.1** | 数据建模 / 认证 / 权限 / 后台 / 钩子 / Local API |
| 数据库 | **PostgreSQL 16**（Drizzle） | 主业务数据（dev 自动 push schema） |
| 缓存/队列 | **Redis 7** | 预留（限流 / 队列 / 缓存） |
| 模型网关 | OpenAI 兼容网关（`MODEL_GATEWAY_*`） | 在线试用与对比的模型调用 |
| 本地 Runner | `runner/`（Node CLI） | 下载后用本地/自有模型运行 |
| 样式 | Tailwind v4 + 集中式 CSS 令牌 | 双主题设计系统 |
| 部署 | Docker 多阶段 + docker-compose | 本地/生产一致 |

---

## 4. 已实现功能清单

### 4.1 数据层（12 Collection + 1 Global）✅
`Users`(auth) · `Categories` · `Skills` · `SkillVersions` · `SkillRuns` · `Reviews` · `Favorites` · `InviteCodes` · `ContributionLogs` · `Bounties` · `Reports` · `Media` · `SiteSettings`(global)
- 函数式 Access Control（集合级 + 字段级）
- **首个用户自动成为超级管理员**（Users beforeChange 钩子）
- 关键钩子：slug 生成、发布 +50、收藏 +1、成功调用 +0.1、评论重算评分、版本→currentVersion
- ⚠️ 已修复 Payload 钩子事务死锁（嵌套写操作透传 `req`）

### 4.2 Skill 运行链路 ✅
`src/lib/` 运行编排（产品文档 §12.2 闭环）：校验输入 → 渲染 Prompt → 选模型（路由）→ 调网关（带 fallback）→ 校验输出格式 → 写 SkillRun → 更新指标 → 发贡献值
- 路由模式 cheap/quality/fast/balanced + fallback；无 Key 自动 mock 回退
- **多模型对比**：`POST /v1/skills/[slug]/compare` 并行跑多模型，前台并排展示成本/耗时/tokens/格式对比表（高亮最优）
- **网关 metadata 透传**：`X-YH-Source / Run-ID / Skill-ID / Skill-Version`（产品文档 §12.4），为关联网关日志铺路

### 4.3 Skill 下载 + 本地 Runner ✅（下载优先核心）
- `GET /v1/skills/[slug]/manifest?format=yaml|json`：导出可移植能力包（产品文档 §10.2）
- 详情页「**下载 Skill**」为主操作，「在线试用」为次操作；`downloadCount` 指标
- `runner/`：本地 Skill Runner CLI，连 Ollama / LM Studio / vLLM / 任意 OpenAI 兼容 endpoint 运行，**算力在用户侧**

### 4.4 前台页面 ✅
首页 · `/skills` 市场（PT 风格表 + 分类/排序/搜索）· 详情（§19）· 在线运行/对比 · `/rank` · `/bounties`（列表/详情/发布）· `/me` · `/login` `/register` · `/docs`

### 4.5 后台（Payload Admin）✅
- 左侧分组重整为 **系统设置 / 成员管理 / Skill 内容 / 审核治理**，一键直达、卡片可快捷新建
- `access.admin` 限制：仅 admin/reviewer/enterprise_admin 进后台，普通用户走前台

### 4.6 体验与工程 ✅
浅/深色主题切换（持久化 + 无闪烁）· 集中式设计系统 · sticky footer · SkillRank 计算 + Worker 重算脚本 · 5 个官方 Skill 种子 · Docker 容器化 · 真实模型网关接入

---

## 5. 端到端验证记录（实测）

| 验证项 | 结果 |
|---|---|
| 生产构建 `npm run build` | ✅ 通过 |
| 真实模型运行（容器内） | ✅ `mocked:false`，合法 JSON，成本/token/格式齐全 |
| 多模型对比 | ✅ haiku vs sonnet 并行；haiku 便宜 4.5×、快 2× |
| **本地 Runner** | ✅ 拉取 manifest + 直连网关运行成功，算力在用户侧 |
| Skill 下载 | ✅ YAML/JSON manifest，downloadCount 累加 |
| 首用户超管 / 后台分组 / 双主题 | ✅ 截图验证 |

---

## 6. 本地运行速查

```bash
docker compose up -d            # postgres(5433) / redis(6380)
cp .env.example .env            # 填 PAYLOAD_SECRET / MODEL_GATEWAY_*
npm install && npm run dev      # http://localhost:3000
npm run seed                    # 注入官方数据
docker compose up -d app        # 容器版 http://localhost:8787

# 本地 Runner（下载后用自己的模型跑）
node runner/hengshu-run.mjs <slug 或 manifest 文件> \
  --endpoint http://localhost:11434/v1 --model qwen2.5 --in topic=秋季护肤
```
- 推荐初始化顺序：先 `/admin` 创建首个用户（自动超管）→ 再 `npm run seed`
- 种子管理员：`admin@yuanheng.ai / admin12345` ｜ 邀请码：`WELCOME1`

---

## 7. 已知限制 / 待加固

- `/rank`、`/me`、`/bounties` 较基础；评测中心为占位（指标来自真实运行聚合）
- Runner 为最小实现（暂无 install 缓存 / 运行记录 / 自动更新）
- 工程：生产需切 migration（当前 dev push）；网关 Key 明文（需加密）；缺邮件适配器、速率限制、自动化测试

---

## 8. 路线图（修订版 · 下载优先）

### 阶段 1（已基本完成）
云端市场 + 在线试用 + 多模型对比 + **Skill 下载** + 最小本地 Runner + 后台分组 + 真实网关接入

### 阶段 2（建议下一步）— 把「下载-运行」做扎实
1. **Runner 升级为可安装 CLI**：`hengshu install <slug>`（缓存 `~/.hengshu/skills`）、`run` / `list` / `update`，本地运行记录
2. **本地模型兼容报告回流**：Runner 跑完可选匿名上报（模型/成功率/耗时/JSON 成功率）→ 中央 `compat-reports` 集合聚合成「本地模型兼容报告」（产品文档 §21.4 对比表）。**数据来自用户侧、零中央算力**，反哺 SkillRank 的本地维度
3. **下载即贡献**：下载量/被复用纳入 PT 机制，给作者发贡献值；详情页展示下载量
4. **在线试用加配额/限流**（Redis），防止把中央当免费算力

### 阶段 3 — 分发网络
5. 安装包版本同步、Runner 自动更新
6. 私有 Skill / 企业内网 Runner（数据完全不出内网）
7. Skill 组合 / 依赖下载（workflow）

### 阶段 4 — 商业化（成本结构更健康）
8. 中央按「分发 / 评测 / 认证」收费，而非按运行收费（运行成本用户自担）
9. 创作者分成基于**下载量 / 采用量**，而非调用量

### 推荐的最小下一步
> **#2 本地模型兼容报告回流 + Runner 缓存安装**：让 Runner 支持 `install/run/list` + `--report` 匿名上报；中央加 `compat-reports` 集合 + 详情页「本地模型兼容报告」区块。坐实「本地运行」为主力，同时让中央拿到差异化数据（哪个本地模型跑这个 Skill 好），且不增加服务器算力。

---

## 9. 关键文件索引

| 路径 | 说明 |
|---|---|
| `src/payload.config.ts` | Payload 主配置（集合/分组/db/admin） |
| `src/collections/*` | 12 个数据集合 + 钩子 |
| `src/access/index.ts` | 权限规则（含后台访问限制） |
| `src/lib/skillRunner.ts` | 运行编排（含 forceModel/skipAggregate/metadata） |
| `src/lib/newapi.ts` | 模型网关客户端（mock 回退 + X-YH-* 透传） |
| `src/lib/manifest.ts` | Skill manifest 构造与序列化（YAML/JSON） |
| `src/app/v1/skills/[slug]/{run,compare,favorite,manifest}` | 对外 API |
| `runner/hengshu-run.mjs` | 本地 Skill Runner CLI |
| `src/app/(frontend)/**` | 前台页面 |
| `docs/yuanheng_skillhub_product_doc_v0.1.md` | 原始产品规划文档 |
