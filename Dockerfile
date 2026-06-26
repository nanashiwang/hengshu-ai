# 元衡 SkillHub —— Next.js(standalone) + Payload 多阶段镜像

# ---- 依赖 ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---- 构建 ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# 构建期占位（页面均 force-dynamic，构建不连库；运行时由 compose 注入真实 env）
ENV PAYLOAD_SECRET=build-time-placeholder
ENV DATABASE_URL=postgres://payload:payload@localhost:5432/skillhub
RUN npm run build

# ---- 运行 ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m nextjs

# standalone 产物（含 traced node_modules，sharp 为 linux 二进制）
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
