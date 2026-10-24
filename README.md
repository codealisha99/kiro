![Kiro](apps/web/public/brand/kiro-wordmark.svg)

# Kiro

A permission-aware company knowledge desk: add documents, ask questions, and inspect the evidence behind each answer. The default stack is Next.js, Spring Boot, PostgreSQL/pgvector, Redis and FastAPI. Model APIs are optional; keyword search and labelled source extracts work without them. The Java API also provides persisted projects, tasks, scoped work metrics, dependency queries, evidence-backed insights with review states, and bounded what-if calculations. Departments, teams, reporting relationships and configurable scoped roles support five dashboard views. Read-only GitHub, Slack, Linear, HubSpot, Xero and BambooHR connectors accept credentials later; live provider validation remains pending. See [organization and integration setup](docs/ORGANIZATION_INTEGRATIONS.md) for capabilities and limits. Drive and S3 remain stubs.

## Start locally

Implementation progress and remaining requirements: [original specification completion status](docs/PLATFORM_COMPLETION_STATUS.md). The full company-intelligence specification is not yet complete.

Requires Docker with Compose. Node 20+ and pnpm 10.30.3 are required for local development/checks.

```bash
pnpm install --frozen-lockfile
cp .env.example .env  # fresh checkout only; preserve an existing file
# Set JWT_SECRET to a generated secret of at least 32 bytes.
# Leave AI_LLM_API_KEY empty for a provider-free demo.
docker compose up -d --build
```

Open http://localhost:3000. API: http://localhost:3001; AI: http://localhost:8000. Exact secret-generation, health checks and demo steps: [Demo guide](docs/DEMO_GUIDE.md).

For frontend-only development: `pnpm --filter @kiro/web dev`. Public pages and `/design-system` work without the backend. Avoid running this alongside the Compose web container on the same port. `pnpm dev` starts the retained NestJS reference API; `pnpm setup` applies legacy Prisma migrations and must not target a Java/Flyway database.

## Verify

```bash
pnpm --filter @kiro/api prisma:generate
pnpm typecheck
pnpm lint
pnpm test
pnpm build
# Separately, with Java 21 and Maven:
mvn -f apps/api-java/pom.xml test
```

Node tests cover the reference API and frontend transport. The October 24 work-intelligence pass verified 92 reference API tests, 12 frontend transport tests, 113 Java tests (including Testcontainers PostgreSQL), lint, type checking, builds, clean Flyway migrations, and live work/insight API and browser workflows. Live external integrations and provider-backed generation remain unverified. See the [engineering report](docs/WORK_INTELLIGENCE_REPORT.md) for scope, exact commands and remaining platform gaps.

## Documentation

- [Work intelligence report](docs/WORK_INTELLIGENCE_REPORT.md): audit, insight triage, verification, functional status and next implementation stages.

- [Product audit](docs/PRODUCT_AUDIT.md): local improvements, verification results, migration notes, and remaining limitations.
- [Project guide](docs/PROJECT_GUIDE.md): features, architecture and honest implementation status.
- [Demo guide](docs/DEMO_GUIDE.md): setup, workflow, pitch and troubleshooting.
- [API dependencies](docs/API_DEPENDENCIES.md): services, credentials, environment variables and official references.
- [Contributing](CONTRIBUTING.md) · [Design system](DESIGN.md) · [Ownership](docs/OWNERSHIP.md) · [Third-party credits](docs/ui-attributions.md)

Maintained by [Alisha Karma / codealisha99](https://github.com/codealisha99) · [Website](https://alishakarma.com) · [Contact](mailto:lishykarma99@gmail.com). Historical and third-party authorship is preserved. No project license is declared.
