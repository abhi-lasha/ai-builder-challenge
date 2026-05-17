FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++ sqlite

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.1.1 --activate

COPY package.json tsconfig.json ./
RUN printf 'allowBuilds:\n  better-sqlite3: true\n  esbuild: true\n' > pnpm-workspace.yaml
RUN pnpm install --prod=false --frozen-lockfile=false

COPY src ./src
RUN pnpm build

FROM node:22-alpine AS runner

RUN apk add --no-cache sqlite

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.1.1 --activate

COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

RUN mkdir -p /app/data

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    API_DATA_DIR=/app/data

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "dist/index.js"]
