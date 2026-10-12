# Kiro APIs, services and configuration

Inventory from code, checked 2026-10-12. “Active” means implemented/referenced by the application, not that a deployed service was tested. No credentials or paid requests were used in this audit.

## Core services

| Service | Status / purpose / unavailable behavior | Environment / credentials | Official reference / cost |
| --- | --- | --- | --- |
| PostgreSQL + pgvector | Required, active: users, documents, versions, keyword/vector retrieval, conversations and audit. Without it, core API workflows fail. Compose uses PostgreSQL 16; vectors are fixed at 1536 dimensions. | `DATABASE_URL`; Java `DB_USER`, `DB_PASSWORD` for JDBC URLs. Local Compose provisions its own database; hosted credentials come from your database administrator/provider. | [PostgreSQL](https://www.postgresql.org/docs/current/), [pgvector](https://github.com/pgvector/pgvector). Self-hosted infrastructure cost; hosted pricing not verified. |
| Redis | Required for reliable authenticated workflows and indexing, active: session checks, rate limits, embedding queue/retries/dead letters. A failed session store can deny access; jobs cannot run normally. | `REDIS_URL`; no separate application Redis key. Hosted URL comes from the Redis provider. | [Redis](https://redis.io/docs/latest/). Local infrastructure cost; hosted pricing not verified. |
| Spring Boot API | Required for signed-in UI, active, self-hosted; not a third-party API. Default port 3001. | `JWT_SECRET` (generate locally, at least 32 bytes); `AI_SERVICE_URL`, `CORS_ORIGINS`. No external authentication account. | [Spring Boot](https://docs.spring.io/spring-boot/index.html). Infrastructure cost only; exact hosting costs unverified. |
| FastAPI AI service | Default stack component, active, self-hosted: `/embed`, `/generate`, `/gateway`, `/admin/health`. When unavailable, semantic retrieval/generation fail; backend attempts keyword/extractive fallback. | Backend `AI_SERVICE_URL`; provider configuration below. No internal-service API-key mechanism is implemented; keep this service private outside local demos. | [FastAPI](https://fastapi.tiangolo.com/). Infrastructure cost; no separate model API subscription inherent to FastAPI. |
| Local filesystem | Active: stores extracted document text, not an S3 integration. Database also retains text. File writes can fail without blocking ingestion. | `STORAGE_DIR`, `STORAGE_DRIVER=local`; filesystem permissions, no API key. Compose has no API upload-storage volume. | No third-party API; disk/persistence is operator-managed. |

## Optional runtime features

| Integration | Status / effect if absent | Configuration / credentials | Official documentation / cost |
| --- | --- | --- | --- |
| OpenAI-compatible chat API | Active HTTP implementation (`/chat/completions`), optional; no key → `/generate` returns 503 and backend uses labelled extracts. Default model `gpt-4o-mini`. | `AI_LLM_BASE_URL`, `AI_LLM_API_KEY`, `AI_LLM_MODEL`. OpenAI keys from [project API keys](https://platform.openai.com/api-keys); alternate provider keys from that provider. | [Authentication/API reference](https://developers.openai.com/api/reference/overview), [pricing](https://developers.openai.com/api/docs/pricing). OpenAI charges by input/output tokens; no fixed rate copied here. Alternate pricing unverified. |
| OpenAI-compatible embeddings API | Active HTTP implementation (`/embeddings`), optional; unavailable → embedding jobs fail/pending, semantic search absent, keyword search remains. Default `text-embedding-3-small`, 1536 dimensions. | `AI_EMBEDDING_BASE_URL`, `AI_EMBEDDING_API_KEY`, `AI_EMBEDDING_MODEL`, `AI_EMBEDDING_DIMENSIONS`. Base/key fall back to LLM base/key if unset. Both models can use one OpenAI project key. | [Embeddings](https://developers.openai.com/api/docs/guides/embeddings), [pricing](https://developers.openai.com/api/docs/pricing): OpenAI embedding charges are token-based. Model access/billing not tested. |
| Google Fonts | Active browser stylesheet requests: IBM Plex Serif, Outfit, IBM Plex Mono. Optional; fallback fonts keep UI usable. | No env or credential. | [Google Fonts CSS API](https://developers.google.com/fonts/docs/getting_started). No metered API pricing verified or assumed. |
| Prometheus/Micrometer metrics | Metrics exposition implemented; an external collector is optional and not configured by Compose. No collector → no external time-series history. | No application collector credential/env. Authenticated API metrics routes exist; management exposure is configured in Spring YAML. | [Prometheus](https://prometheus.io/docs/introduction/overview/). Collector hosting/pricing unverified. |

Provider settings support configurable compatible endpoints, but only one chat provider is wired in `apps/ai/app/routes.py`; no operational multi-provider failover is configured. The service requires a nonempty key even for compatible endpoints that normally accept keyless requests. Never put provider keys in `NEXT_PUBLIC_*` variables.

## Stubs, development and hosting

| Item | Actual use / credential requirement |
| --- | --- |
| Google Drive, Slack, CRM | Stub connectors in both APIs: empty document lists and synthetic health; no external calls, OAuth flow or credential env variables. [Drive API](https://developers.google.com/workspace/drive/api/guides/about-sdk), [Slack](https://docs.slack.dev/) are future references; CRM vendor unspecified. Do not obtain credentials for the current implementation. |
| Amazon S3 | Unimplemented. `STORAGE_DRIVER=s3` warns and uses local files; no AWS credential settings/client are wired. |
| NestJS/Prisma/BullMQ | Retained alternate API and Node tests; uses the same service types, but a separate Prisma migration history. No extra API provider. |
| Docker/registries, npm, PyPI, Maven Central | Development/build dependencies: images and packages, not product APIs. Public artifacts need no project-specific key. [Docker Compose](https://docs.docker.com/compose/), [npm](https://docs.npmjs.com/), [PyPI](https://pypi.org/help/), [Maven Central](https://central.sonatype.org/). Network availability required for uncached installs. |
| GitHub / Actions | Repository and two CI workflows; optional for local run, no product runtime call. GitHub account/repository access for remote operations; Actions supplies `GITHUB_TOKEN`. [Actions docs](https://docs.github.com/en/actions). Hosted allowances/cost not verified. |
| Vercel | Frontend hosting recorded in deployment docs; optional for local run. Dashboard/CLI authentication for deployment; `NEXT_PUBLIC_API_URL` configured before build. [Docs](https://vercel.com/docs). Account plan/current deployment not inspected; cost unverified. |
| Railway | API, AI, PostgreSQL and Redis hosting recorded in `docs/DEPLOY.md` and `.railway/railway.ts`; optional locally. Platform account/CLI authentication; service variables are unmanaged by IaC. [Docs](https://docs.railway.com/). Current resources/billing unverified. `REDIS_PASSWORD` and `RAILWAY_VOLUME_MOUNT_PATH` are service/platform variables referenced by its Redis start command, not application credentials. |
| Aceternity UI, Hugeicons | Adapted UI/package assets, not remote runtime services; no credential. Preserve [source credits](ui-attributions.md). |

No payment, SMTP, analytics, external search engine, Clerk/Auth0 or webhook integration is implemented.

## Complete application configuration names

Defaults are in `application-*.yml`, `apps/ai/app/config.py`, `.env.example` and Compose. Defaults are not production credentials.

| Scope | Names / behavior |
| --- | --- |
| Browser | `NEXT_PUBLIC_API_URL`: public, browser-reachable API URL, baked into Next.js build; default localhost:3001. `KIRO_NEXT_DIST_DIR`: build/dev output override; dev script sets `.next-dev`. |
| API connections/security | `DATABASE_URL`, `DB_USER`, `DB_PASSWORD` (Java JDBC only); `REDIS_URL`; `JWT_SECRET`; `JWT_EXPIRES_IN_SECONDS` (3600); `AI_SERVICE_URL`; `CORS_ORIGINS` (Java comma-separated origins), `CORS_ORIGIN` (legacy NestJS singular). |
| API runtime | `PORT` (3001), `LOG_LEVEL`, `SPRING_PROFILES_ACTIVE` (Java `local`/`production`/`test`), `STORAGE_DIR`, `STORAGE_DRIVER`; Java `CHUNKER_CHUNK_SIZE` (1000), `CHUNKER_OVERLAP` (200). NestJS chunk sizes are hard-coded injection values, not env overrides. `NODE_ENV` affects legacy log formatting and framework mode. |
| Chat | `AI_LLM_BASE_URL`, `AI_LLM_API_KEY`, `AI_LLM_MODEL`; `AI_LLM_MAX_TOKENS` (1024), `AI_LLM_TEMPERATURE` (0), `AI_LLM_TIMEOUT_SECONDS` (90), `AI_LLM_RETRIES` (2). |
| Embeddings | `AI_EMBEDDING_BASE_URL`, `AI_EMBEDDING_API_KEY`, `AI_EMBEDDING_MODEL`, `AI_EMBEDDING_DIMENSIONS` (1536; must match DB vectors). |
| Local tools | `API_URL` for E2E/performance scripts; `KIRO_TOKEN` for the legacy performance script (a valid local access token); `JAVA_HOME` when selecting a local Java 21 installation. |
| Container infrastructure | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` are image initialization variables set by Compose, not API settings. |

**Loading matters:** Compose reads root `.env` for interpolation, then passes only listed `environment` entries. It currently forwards the basic five AI settings, not separate embedding keys/base URLs or advanced tuning; add a local Compose override to pass those if needed. Java itself does not automatically read `.env`: native Java startup needs exported env variables. NestJS/Python load root `.env` through their own config. Next.js reads its app environment/shell; setting a root `.env` alone is insufficient for native web development. Explicit Compose URLs override connection entries in `.env`.

For Java `production`, set database credentials, Redis URL, JWT secret, allowed origins and AI URL explicitly; ensure durable storage. [DEMO_GUIDE.md](DEMO_GUIDE.md) covers safe local setup; [DEPLOY.md](DEPLOY.md) contains existing hosting guidance, not authorization to deploy.
