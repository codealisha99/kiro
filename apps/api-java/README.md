# kiro-api (Java 21 + Spring Boot 3)

Spring Boot port of `apps/api` (NestJS). Drop-in replacement: same REST contracts
(see `/API_CONTRACT.md`), same PostgreSQL + pgvector schema, same Redis usage,
same FastAPI AI service, same Next.js frontend.

Stack decisions (one each): **Maven**, **Flyway**, Redis-list embed queue,
PDFBox/POI parsers, JJWT, Micrometer + Actuator.

## Run locally (needs Postgres/pgvector :5433 + Redis :6379)

```bash
# infra (NestJS compose services)
docker compose up -d postgres redis

export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export DATABASE_URL="postgresql://kiro:kiro@localhost:5433/kiro?schema=public"
export REDIS_URL="redis://localhost:6379"
export JWT_SECRET="local-dev-secret-that-is-at-least-32-chars-long"
export AI_SERVICE_URL="http://localhost:8000"
export CORS_ORIGINS="http://localhost:3000"

mvn spring-boot:run            # serves :3001 (SPRING_PROFILES_ACTIVE=local default)
```

Point the frontend at it: `NEXT_PUBLIC_API_URL=http://localhost:3001 pnpm --filter @kiro/web dev`.
Run with the Java backend in compose: `docker compose --profile java up --build postgres redis ai api-java web`.

## Environment

| Var | Default (local) | Notes |
|---|---|---|
| `DATABASE_URL` | `jdbc:postgresql://localhost:5433/kiro?...` | Accepts `jdbc:` AND Prisma-style `postgresql://` (auto-converted) |
| `DB_USER` / `DB_PASSWORD` | `kiro` / `kiro` | Used only for `jdbc:` URLs; Prisma-style URLs carry credentials |
| `REDIS_URL` | `redis://localhost:6379` | Sessions, throttle, embed queue, DLQ |
| `JWT_SECRET` | (none) | **Required.** No dev fallback — boot fails fast without it, except `local`/`test` profiles |
| `JWT_EXPIRES_IN_SECONDS` | `3600` | |
| `AI_SERVICE_URL` | `http://localhost:8000` | FastAPI `/embed` `/generate` `/gateway`(GET) |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowlist, never `*` |
| `STORAGE_DIR` / `STORAGE_DRIVER` | `/tmp/kiro-storage` / `local` | `s3` warns + falls back (same as NestJS) |
| `CHUNKER_CHUNK_SIZE` / `CHUNKER_OVERLAP` | `1000` / `200` | |
| `PORT` | `3001` | |

## Security model (mirrors NestJS, plus fixes)

- Bearer JWT (`sub`, `tenantId`, `role`) + Redis `session:{userId}` marker enforced per request.
  Logout deletes the marker AND the `sessions` row, so logged-out tokens are rejected
  (the old `jti:` delete was a no-op — fixed here).
- Tenant isolation + ACL (owner / PUBLIC+INTERNAL / USER / ROLE grants) enforced **inside**
  the retrieval SQL — unauthorized chunks never reach Java code or the LLM.
- `GROUP` grants are **fail-closed**: no membership model exists, so they grant nothing
  (documented; same effective behavior as NestJS, now explicit + tested).
- `users` uniqueness is `(tenant_id, email)` — same email can exist in two tenants
  (was globally unique in Prisma — fixed here).
- Guarded in this backend (were public in NestJS): `/metrics`, `/metrics/prometheus`,
  `/evals/*` (manager/admin). `/admin/health` alias removed (use `/health`).
- Unauthenticated → `401`, wrong role → `403` (matches NestJS guard semantics).

## Tests

```bash
mvn test      # 46 unit + Spring context tests (H2, no Docker needed)
```

Live DB/Redis integration + golden evals (`GET /evals/retrieval`, `GET /evals/rag`)
require the compose stack + `AI_LLM_API_KEY`.
