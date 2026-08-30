# Company Brain — Build Plan

This plan turns the PRD (`PRODUCT REQUIREMENTS DOCUMENT (PRD) COMPANY BRAIN.pdf`) and the `.context/` bundle into an executable engineering roadmap. It follows the PRD's own Phase 1–6 structure, each with exit criteria.

## 0. Approach & Conventions

- **Monorepo:** pnpm workspaces + Turborepo.
- **Stack (from `.context/10-stack.md`):** React/Next.js/TS → NestJS/Node + pgvector + Redis + BullMQ + Python FastAPI AI service + provider-independent LLM Gateway + S3 + Docker + GitHub Actions + OpenTelemetry/Prometheus/Grafana.
- **Development order** is dictated by dependencies: Foundation → Ingestion → Retrieval → RAG → Security Hardening → Pilot.
- **Testing is mandatory per phase** (the PRD mandates evaluation from the start). Each phase ends when its exit criteria pass.
- **Non-negotiables** (from `.context/README.md`):
  - Query-time authorization — LLM never receives unauthorized content.
  - Tenant isolation — every DB object carries `tenant_id`; all queries tenant-scoped.
  - Evaluation built in from the start.
  - LLM provider independence via a Gateway abstraction.
  - Fail closed on security-sensitive errors.

---

## 1. Repository Structure (Phase 0 — Scaffold)

```
alisha-1/
├── .context/                    # PRD-derived context (source of truth)
├── build-plan.md                # THIS FILE
├── package.json                 # pnpm + turbo root
├── turbo.json
├── pnpm-workspace.yaml
├── docker-compose.yml           # pgvector, redis, etc.
├── apps/
│   ├── web/                     # React + Next.js + TS  (frontend)
│   ├── api/                     # NestJS + TS           (backend)
│   └── ai/                      # Python + FastAPI      (AI service)
├── packages/
│   ├── shared/                  # shared TS types (DTOs, constants)
│   ├── database/                # Prisma/Drizzle schema + migrations
│   └── llm-gateway/             # provider-agnostic LLM abstraction
└── infra/                       # docker, monitoring, CI
    ├── grafana/
    ├── prometheus/
    └── otel/
```

**Exit criteria:** `pnpm install`, `turbo build`, `turbo dev` work for all apps. Full stack runs via `docker-compose`.

---

## 2. Phase 1 — Foundation

Goal: secure, tenant-aware API foundation.

**Build:**
- Project structure (done in Phase 0)
- Authentication (SSO/OIDC where available; JWT/session for MVP)
- Users, Roles, Tenants
- PostgreSQL + Redis wiring
- Structured logging
- Shared types package

**Data model (from `.context/04-data-model.md`):** start with `User`, `Role`, `Tenant`, `Permission` tables; every table carries `tenant_id`.

**API surface (from `.context/05-api-design.md`):** `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`.

**Testing:** auth, RBAC, tenant isolation, API unit tests.

**Exit criteria:** Secure API foundation is operational — login/logout/me work, JWT protects routes, RBAC enforced, tenant isolation verified by tests.

---

## 3. Phase 2 — Ingestion

Goal: company data reliably enters the knowledge layer.

**Build:**
- Google Drive, Slack, CRM connectors (`apps/api` + connector layer)
- Parser / Normalizer / Chunker / Metadata / ACL extraction
- Job queue (BullMQ over Redis)
- pgvector schema for embeddings
- Ingest → store pipeline: meta in PostgreSQL, embeddings in pgvector, originals in S3

**Data model additions:** `Source`, `Document`, `DocumentVersion`, `DocumentChunk`, `DocumentACL`.

**Testing (from `.context/07-evaluation.md`):** ingestion correctness, duplicate events, update events, delete events, malformed documents, ACL extraction.

**Exit criteria:** Company data can reliably enter the knowledge layer (idempotent, retryable). See `.context/10-stack.md` ingestion workflow.

---

## 4. Phase 3 — Retrieval

Goal: relevant and *authorized* information is retrieved.

**Build:**
- Semantic retrieval (embeddings → pgvector)
- Keyword retrieval (PostgreSQL FTS)
- Hybrid ranking + metadata filtering
- Permission filtering (join ACL on `tenant_id` + principal)

**Testing:** Recall@5, Precision@5, MRR, permission leakage (targets in `.context/01-requirements.md`).

**Exit criteria:** Relevant AND authorized info retrieved. Recall@5 >= 85%, Precision@5 >= 75%, zero permission leakage.

---

## 5. Phase 4 — RAG

Goal: trustworthy answers grounded in retrieved evidence.

**Build:**
- Context construction
- LLM Gateway (`packages/llm-gateway`) — provider-independent (`.context/03-components.md` 6.7)
- Answer generation
- Citation generation + source provenance
- Unknown / ambiguity handling (`.context/01-requirements.md`)

**API additions:** `POST /brain/query`, `GET /documents...`, `GET /sources...`, `GET /conversations...`, `POST /feedback`.

**Data model additions:** `AIRequest`, `AIResponse`, `ResponseEvidence`.

**Testing:** groundedness, hallucination, citation correctness, unknown handling, cross-source questions.

**Exit criteria:** Brain provides trustworthy answers based on retrieved evidence (Citation >= 95%).

---

## 6. Phase 5 — Security Hardening

Goal: zero unauthorized data disclosure.

**Build:**
- Query-time authorization enforcement (LLM never gets unauthorized content — `.context/06-security.md` 7.3)
- Permission revocation handling
- Tenant isolation finals
- Audit logging
- Prompt injection defenses
- Security monitoring

**Testing (from `.context/06-security.md` matrix):** RBAC, ABAC where required, IDOR, cross-tenant, revoked permissions, prompt injection, data poisoning. Plus revocation, injection, delete tests from `07-evaluation.md`.

**Exit criteria:** Zero unauthorized data disclosure in the defined security test suite.

---

## 7. Phase 6 — MVP Pilot

**Deploy to** 20–50 users, one department, three data sources.

**Collect:** usage, feedback, failed queries, missing sources, retrieval failures, permission issues.

**Measure:** weekly active users, query success, retrieval quality, latency, cost, time saved.

**Exit criteria:** MVP success criteria from `.context/01-requirements.md` — employees can ask questions, inspect sources, trust answers; at least one workflow shows measurable time savings.

---

## 8. Roadmap (Post-MVP)

V2 Role Intelligence → V3 Organizational Memory → V4 Decision Intelligence → V5 Agents → V6 Safe Actions. (`.context/09-roadmap.md`)

Build on top of the infrastructure; no redesign.

---

## 9. Cross-Cutting Concerns (built during Phases 1–5)

- **Observability** (`.context/10-stack.md`): request count, latency, errors, availability (API); model/tokens/latency/cost (AI); results/latency/scores/sources (retrieval); processed/failed/updated/deleted/queue depth (ingestion).
- **Reliability:** request timeout, retry w/ backoff, dead-letter queue, health checks, idempotency, structured logs, graceful degradation. Never retry into duplicate side effects.
- **Admin API & dashboard:** sources, knowledge, security, AI stats.
- **CI/CD:** GitHub Actions; Docker images; no Kubernetes for MVP.

---

## 10. Immediate Next Step

Begin **Phase 0 — Scaffold**: initialize the pnpm + Turborepo monorepo, `docker-compose`, and the app/package skeleton. Once scaffolded and green (`turbo build` + `turbo dev`), move into Phase 1 features.
