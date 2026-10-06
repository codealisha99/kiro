# Kiro Backend Migration Plan — NestJS → Java 21 + Spring Boot 3

> Status: audit complete, migration in progress. Source of truth for behavior: `apps/api/src`.
> Decisions (one each, used consistently): **Maven** (not Gradle), **Flyway** (not Liquibase).
> Old backend `apps/api` stays untouched as reference until parity is proven.

## 1. Module map

| # | NestJS module (files) | Responsibility | Spring Boot replacement | Java package `com.kiro.api.*` |
|---|---|---|---|---|
| 1 | `auth/` (module, controller, service, jwt.strategy, dto, jwt-payload) | register/login/logout/me, bcrypt, JWT issue, Redis session marker | Spring Security `SecurityFilterChain` + `JwtAuthFilter` + `AuthController/Service`, `PasswordEncoder(BCrypt)` | `security`, `auth` |
| 2 | `users/` (controller, service) | admin-only list/invite, demo viewer bootstrap | `UserController/Service`, `User` JPA entity | `user` |
| 3 | `common/guards` (jwt, roles + spec), `decorators`, `throttle.guard`, `logging.module`, `prompt-sanitize` (+spec) | JWT guard, role guard (admin bypass), per-IP/user 30/min throttle on query+upload, pino logging, `<<EVIDENCE>>` wrap + 8 injection regexes | `security` filter chain + `@PreAuthorize`/custom `RoleInterceptor`, `RateLimitFilter` (Redis or in-memory), Logback + `MdcFilter`, `PromptSanitize` util | `security`, `common` |
| 4 | `prisma/` + `prisma/schema.prisma` + 4 migrations | 14 models, pgvector `vector(1536)`, unique `[tenant,source,external]`, soft-delete flags | JPA entities + Spring Data repos; pgvector similarity via `JdbcTemplate` native SQL; **Flyway** migrations `V1..Vn` ported from Prisma SQL | `domain` (entities/repos) |
| 5 | `redis/` (module, service via ioredis) | sessions `session:userId`, BullMQ connections | Spring Data Redis `StringRedisTemplate` | `config`, `common` |
| 6 | `ingestion/` (module, service, queue, processor, parser+spec, chunker+spec, dto, demo-corpus, documents+sources controllers) | sources CRUD, manual ingest/upsert/version/dedupe, upload parse, demo seed (7 docs + viewer), chunk 1000/200, embed-queue | `DocumentController`, `SourceController`, `IngestionService`, `ParserService` (PDFBox/POI), `ChunkerService`, `IngestJobService` (Redis-backed) + worker, `DemoCorpus` | `document`, `ingestion`, `job` |
| 7 | `retrieval/` (service+spec, fusion+spec) | semantic pgvector cosine + FTS `ts_rank`, RRF `1/(rank+61)`, cap 5, SQL-enforced tenant+ACL+deleted+APPROVED | `RetrievalService` (JdbcTemplate native SQL, same predicates), `RrfFusion` | `retrieval` |
| 8 | `brain/` (controller, service+spec) | TOP_K=5, excerpt 240, SYSTEM_PROMPT+STATUS, unknown short-circuit, `ai.generate` w/ extractive `partial` fallback, cite regex, `max(score)` confidence, AIRequest/Response/Evidence + audit writes | `RagService` + `BrainController`, same constants and flow | `rag` |
| 9 | `ai-gateway/` (service) | HTTP client to FastAPI `/embed /generate /gateway`, 30s timeout, 503 mapping | `AiServiceClient` (RestClient) — **fix `/gateway` to GET** | `ai` |
| 10 | `connectors/` (interface + drive/slack/crm stubs + service) | `fetch()->[]` stubs; `sync` loop ingests + `lastSyncAt` | `Connector` interface + 3 stub `@Component`s + `ConnectorService` (same contract, ready for real OAuth) | `connector` |
| 11 | `storage/` (service) | `put/get` local disk, `STORAGE_DRIVER=s3` warns+falls back | `DocumentStorage` interface + `LocalDocumentStorage` (+ `S3DocumentStorage` stub w/ same fallback) | `storage` |
| 12 | `conversations/` (controller, service) | list/create/get(tenant+owner, evidence→citations) | `ConversationController/Service` | `conversation` |
| 13 | `feedback/` (controller) | `POST /feedback` validates own request | `FeedbackController/Service` | `feedback` |
| 14 | `admin/` (controller) | `GET audit/ingestion/metrics` (admin-only) | `AdminController/Service` | `admin` |
| 15 | `evals/` (module, controller, service) + `evals/golden.json` (6 cases) | `runRetrieval` title-first-word hitRate + `recallAt5` alias; `runRag` substring accuracy | `EvaluationController/Service`, golden JSON on classpath; same math + honest naming; **guard with manager/admin** | `evaluation` |
| 16 | `metrics/` (controller, service) | in-memory counters/latencies, `/metrics` JSON + `/metrics/prometheus` | Micrometer + Actuator `/actuator/prometheus`; keep compatible JSON at `/metrics` for frontend; **guard both** | `common` |
| 17 | `health/health.controller` | `GET /health` + `GET /admin/health` (db/redis/ai checks, degraded) | Actuator health + keep `GET /health` compat; **remove/guard `/admin/health`** | `common` |
| 18 | `app.module`, `main.ts` | module wiring, ValidationPipe whitelist, 12mb body, CORS | `KiroApplication`, `@ConfigurationProperties`, `GlobalExceptionHandler`, Jackson config | `config`, `common` |

## 2. Endpoints affected — all preserved (see API_CONTRACT.md)

32 routes: `/auth/*`, `/brain/query`, `/documents*`, `/sources*`, `/conversations*`,
`/feedback`, `/users*`, `/admin/*`, `/evals/*`, `/metrics*`, `/health`, `/admin/health`.

## 3. Tables affected — all 14 preserved, 3 fixes during migration

`Tenant, users, sessions, sources, documents, document_versions, document_chunks,
document_acl, conversations, ai_requests, ai_responses, response_evidence, audit_logs, feedback`.
Flyway `V1` = consolidated port of the 4 Prisma migrations (init + ingestion + mvp_content_status + usage_tokens).
Fixes: (a) `users` → `UNIQUE(tenant_id,email)` instead of global email unique;
(b) add `CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)` on `document_chunks`;
(c) `sessions` — either used or dropped (decision: keep table, write session row + Redis marker; document in README).

## 4. Redis / jobs

- `session:{userId}` marker (7d) → same key via `StringRedisTemplate`.
- Throttle 30/min per IP-or-user on `POST /brain/query`, `POST /documents/upload` → `RateLimitFilter` (Redis INCR+EXPIRE, in-memory fallback).
- BullMQ `ingestion` queue (jobId `embed-version-{id}`, attempts 4, exp-backoff 5s, concurrency 4) →
  Java `IngestJobService`: Redis list `kiro:jobs:embed` + `ScheduledExecutorService` worker pool (4),
  attempts 4, backoff 5/10/20/40s, DLQ list `kiro:jobs:embed:dlq`, stats for `GET /admin/ingestion`.
- Failed-job visibility + queue depth: `LLEN` counters exposed via admin endpoint.

## 5. Tests to preserve/recreate (JUnit 5 + Mockito + Spring Boot Test)

All 10 NestJS specs → Java equivalents: auth (register/login/bad-pw), roles guard,
users tenant scoping, chunker, parser, ingestion revoke, RRF fusion, retrieval SQL predicate
(USER+ROLE+PUBLIC/INTERNAL+tenant/deleted/APPROVED), prompt-sanitize (8 patterns + wrap),
brain (unknown short-circuit, citation strip, 503 audit). Plus NEW: tenant-A/B live isolation
(Testcontainers postgres+pgvector), GROUP fail-closed, email-per-tenant, logout invalidation,
upload/version/dedupe, RAG fallback, admin-guard 401/403, leakage suite.

## 6. Migration risks

1. pgvector via Hibernate — mitigated: native SQL through JdbcTemplate, same operators.
2. Embedding `vector(1536)` literal formatting — same `[v,...]::vector` construction, tested.
3. FTS `plainto_tsquery` behavior identical (same Postgres).
4. JWT secret mismatch during cutover — frontend just re-logins; no token migration needed.
5. ID type: Prisma `cuid` strings → Java `UUID`/`CUID` strings kept as `VARCHAR` — no integer PK change.
6. `metadata JSONB` (chunk index/source) — Jackson `JsonNode` + `pgjdbc jsonb` handling.
7. Multipart upload semantics (field `file`, 10MB) — Spring `MultipartFile`, same limits.
8. Case conventions: enums stored UPPER in DB, lowercase on wire — same normalize functions.
9. `confidence = max(score)` is uncalibrated — preserved as-is, documented (not a probability).
10. AI `/gateway` GET-vs-POST — fixed on Java side; Python untouched.
