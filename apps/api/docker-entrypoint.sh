#!/bin/sh
set -e
cd /app
pnpm --filter @kiro/api exec prisma migrate deploy
exec node apps/api/dist/main.js
