# Company Brain — Project Context

This folder contains the full context for building **Company Brain**, an Enterprise AI Knowledge Infrastructure MVP, extracted from `PRODUCT REQUIREMENTS DOCUMENT (PRD) COMPANY BRAIN.pdf` (Version 1.0).

## What is Company Brain?

A centralized, **permission-aware** AI knowledge infrastructure that connects to a company's existing data sources (Google Drive, Slack, CRM) and makes **authorized** organizational knowledge searchable through an AI chat interface — with grounded, cited answers. It is an **MVP infrastructure foundation**, not a fully autonomous agent.

**Priority:** Security > Correctness > Trust > Simplicity > Scale

**MVP question:** *"Can we build a trustworthy AI layer over the company's existing information?"*

## Stack (TL;DR)

React / Next.js / TypeScript → NestJS / Node → PostgreSQL + pgvector · Redis + BullMQ · Python FastAPI AI service · provider-independent LLM Gateway · S3 · Docker · GitHub Actions · OpenTelemetry / Prometheus / Grafana.

## Files

| File | Contents |
|------|----------|
| [00-overview.md](00-overview.md) | Vision, goal, priorities, end state, foundational contract |
| [01-requirements.md](01-requirements.md) | Scope in/out, query types, unknown handling, success criteria, quality targets |
| [02-architecture.md](02-architecture.md) | High-level MVP + deployment architecture, retrieval + RAG pipelines |
| [03-components.md](03-components.md) | Frontend, Backend, Connectors, Ingestion, Knowledge Store, Retrieval, LLM Gateway, RAG |
| [04-data-model.md](04-data-model.md) | Document / Version / Chunk / ACL + Query data models, provenance, versioning, conflicts |
| [05-api-design.md](05-api-design.md) | All REST endpoints (auth, query, documents, sources, conversations, feedback, admin) |
| [06-security.md](06-security.md) | Auth, RBAC, query-time authorization, tenant isolation, audit logging, security test matrix |
| [07-evaluation.md](07-evaluation.md) | The 10 evaluation frameworks + metrics & targets |
| [08-dev-phases.md](08-dev-phases.md) | Phase 1–6 roadmap + exit criteria |
| [09-roadmap.md](09-roadmap.md) | V2–V6 future capabilities (role intelligence → safe actions) |
| [10-stack.md](10-stack.md) | Full tech stack, deployment, workflows, error handling, reliability, observability, admin |

## Key Non-Negotiables

- **Query-time authorization is mandatory** — the LLM must never receive unauthorized content.
- **Tenant isolation** — every DB object carries `tenant_id`; all queries are tenant-scoped.
- **Evaluation built in from the start**, not a future feature.
- **LLM provider independence** via a small Gateway abstraction.
- **Fail closed** on security-sensitive errors.

## Key Quality Targets

| Metric | Target |
|--------|--------|
| Retrieval Recall@5 | >= 85% |
| Retrieval Precision@5 | >= 75% |
| Citation Correctness | >= 95% |
| Unknown Detection | >= 95% |
| Permission Leakage | = 0 |
| Unauthorized LLM Context | = 0 |
| Freshness SLA Compliance | >= 95% |
| Standard Query P95 | < 5 sec |
| API Availability | >= 99.9% |
