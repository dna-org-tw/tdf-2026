# 使用多階段構建以優化映像大小
FROM node:22-alpine AS base

# 安裝依賴階段
FROM base AS deps
# 檢查 https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine
# 了解為什麼可能需要 libc6-compat
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 複製依賴檔案
COPY package.json package-lock.json* ./
RUN npm ci

# 構建階段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 設置環境變數以確保生產構建
ENV NEXT_TELEMETRY_DISABLED 1

# 構建應用
RUN npm run build

# 生產階段
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 複製必要檔案
COPY --from=builder /app/public ./public

# 設置正確的權限
# 自動利用輸出跟踪來減少映像大小
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
