# Migration Parity — NestJS → Spring Boot (`apps/api-java`)

Legend: `[x]` complete · `[~]` in progress · `[ ]` not started · `[!]` intentional behavior difference (documented).

## Endpoints

| Endpoint | Status | Notes |
|---|---|---|
| POST /auth/register, POST /auth/login, POST /auth/logout, GET /auth/me | [x] | Same shapes/codes; email lowercased; first user admin |
| POST /brain/query | [x] | TOP_K=5, same SYSTEM_PROMPT/STATUS/cite/confidence, throttle 30/min |
| GET/POST /documents, POST /documents/upload, POST /documents/demo | [x] | 10MB, same ingest/version/dedupe/demo+viewer |
| GET /documents/:id, GET /documents/:id/versions | [x] | Same visible-only 404, chunk ordering by metadata.index |
| DELETE /documents/:id, POST /documents/:id/revoke | [x] | Same owner/admin/ACL-ADMIN rules |
| GET/POST/DELETE /sources, POST /sources/:id/sync | [x] | Same RBAC; sync still stub-backed (fetch→[]) |
| GET/POST /conversations, GET /conversations/:id | [x] | Same tenant+owner scoping, message shape |
| POST /feedback | [x] | Same own-request check |
| GET /users, POST /users/invite | [x] | Admin-only, tenant-scoped |
| GET /admin/audit, /admin/ingestion, /admin/metrics | [x] | Same shapes; queue stats from Redis backend |
| GET /evals/retrieval, GET /evals/rag | [x] | Same math + golden.json; now manager/admin [!] |
| GET /metrics, GET /metrics/prometheus | [x] | Same JSON shape + Prometheus text; now admin-only [!] |
| GET /health | [x] | Same shape; AI probe uses GET /gateway (NestJS POST was wrong) [!] |
| GET /admin/health | [!] | Removed (was an unguarded alias); use /health |

## Cross-cutting

| Area | Status | Notes |
|---|---|---|
| Auth (JWT/BCrypt/session) | [x] | Logout now truly invalidates (marker + row) [!] |
| Tenant isolation | [x] | Same per-query scoping |
| RBAC (employee/manager/admin) | [x] | Admin bypass preserved via ROLE_ hierarchy |
| ACL (USER/ROLE) | [x] | Same SQL predicates in retrieval + JPA for lists |
| GROUP ACL | [!] | Fail-closed + documented (was silently ignored) |
| DB parity (14 tables) | [x] | Flyway V1 ports all Prisma migrations |
| Email uniqueness | [!] | UNIQUE(tenant_id,email) — was global (bug fix) |
| pgvector (1536, cosine, FTS, RRF) | [x] | Same operators + HNSW index added [!] |
| RAG (unknown/ambiguous/partial/citations/provenance/usage/audit) | [x] | |
| Parsers (PDF/MD/TXT/CSV/DOCX/XLSX) | [x] | PDFBox/POI; same caps/messages; tag-strip fallback kept |
| Chunking 1000/200 | [x] | Same algorithm incl. overlap + hard-slice |
| Embed queue (idempotent, 4 attempts, exp-backoff, conc. 4) | [x] | Redis list/zset + DLQ (new: DLQ was missing) |
| Storage abstraction | [x] | Local + s3-warn-fallback (same) |
| Sessions model | [!] | Now actually written/deleted (was dead) |
| JWT fallback secret | [!] | Removed; boot fails fast (except local/test) |
| CORS | [!] | Explicit allowlist (was `*`) |
| Error shape | [!] | `{timestamp,status,error,message,path,requestId}` (was NestJS default) |
| Tests (46: auth/tenant/chunk/parser/ACL-shape/RRF/sanitize/RAG/context) | [x] | Live PG/Redis + 50-query eval harness still open |
| Docker (multi-stage, compose `java` profile) | [x] | `docker compose --profile java up --build ...` |
| CI (build + tests + docker build) | [x] | New `java` job |

## Remaining gaps (before removing NestJS)

- [ ] Live end-to-end run against compose PG/Redis + frontend click-through (Docker Desktop was paused; not yet executed here)
- [ ] Live two-tenant + leakage adversarial suite against real DB (unit-level predicates covered)
- [ ] 50-query golden set (currently 6, same as NestJS)
- [ ] Real Drive/Slack/CRM connector (stub parity only — same as NestJS)

**Verdict: NestJS can NOT yet be removed** — parity is implemented and unit-verified
(`mvn verify` green, context boots), but the live compose run + frontend check above
must pass first.
