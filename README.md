![Kiro](apps/web/public/cover.png)

# Kiro

Ask what the company knows. Follow answers back to the evidence you are allowed to see.

Kiro is a permission-aware internal knowledge desk: ingest company documents, retrieve the right passages, and answer with citations.

## Frontend design system

The design direction is **trustworthy and calm**: sage surfaces, teal actions, and clearly marked evidence. See [DESIGN.md](DESIGN.md) for tokens, typography, layout, and component guidelines.

Run `pnpm --filter @kiro/web dev` and open [the live design system](http://localhost:3000/design-system) to review shared components and example screens in light and dark themes. The reference page works without backend services.

## Run it locally

The default Docker stack runs the Spring Boot API. The pnpm development workspace runs the retained NestJS API for reference and parity testing.

```bash
cp .env.example .env
# Configure local service URLs and a strong JWT_SECRET.
pnpm install
# Default stack: Java API, PostgreSQL/pgvector, Redis, AI service, web
docker compose up -d --build
```

For frontend-only development (no backend required for public pages):

```bash
pnpm --filter @kiro/web dev
# If port 3000 is occupied:
KIRO_NEXT_DIST_DIR=.next-dev pnpm --filter @kiro/web exec next dev -p 3010
```

Development writes to `.next-dev`; production builds write to `.next`, so the two can run independently. For Java API development and tests, see [apps/api-java/README.md](apps/api-java/README.md). `pnpm setup` applies the legacy Prisma migrations: use it only with a disposable NestJS development database, not an existing Java/Flyway database.

- Web: http://localhost:3000
- API: http://localhost:3001
- AI service: http://localhost:8000

Without `AI_LLM_API_KEY`, keyword search and extractive fallback still work; semantic search and LLM answers degrade.

### Full Docker stack (no `pnpm dev`)

```bash
cp .env.example .env
docker compose up -d --build
```

The API container applies Prisma migrations on startup. Do **not** also run `pnpm dev` while the compose `api`/`web`/`ai` services are up — they share ports 3000/3001/8000.

### Demo walkthrough

1. Open `/app?mode=register` and register a workspace
2. Open **Library**, then **Try with sample documents**
3. Browse the sample documents; search preparation runs in the background
4. Ask: “What is our refund policy?”

## Deploy to production

See **[docs/DEPLOY.md](docs/DEPLOY.md)** for the full step-by-step: accounts to create, VPS setup, env secrets, HTTPS, and launch checklist.

## Maintenance and verification

Maintained by [Alisha Karma](https://alishakarma.com) ([codealisha99](https://github.com/codealisha99)). [Contact](mailto:lishykarma99@gmail.com) · [X](https://x.com/karmalisha). This attribution identifies the current maintainer; historical contributors remain recorded in Git.

See [CONTRIBUTING.md](CONTRIBUTING.md), [third-party UI credits](docs/ui-attributions.md), and [the product audit](docs/audit/product-audit.md). No project license is currently declared.

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
# Separately, with Java 21 and Maven installed:
cd apps/api-java && mvn test
```

`pnpm test` covers the retained NestJS API and frontend transport regressions; it does not run Java or browser tests. `scripts/e2e-check.sh` creates test accounts/documents and belongs on disposable local infrastructure.
