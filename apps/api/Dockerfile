FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @kiro/api prisma:generate
RUN pnpm --filter @kiro/api build
RUN chmod +x apps/api/docker-entrypoint.sh
EXPOSE 3001
CMD ["apps/api/docker-entrypoint.sh"]
