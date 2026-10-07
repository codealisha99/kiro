![Kiro](apps/web/public/cover.png)

# Kiro

Ask what the company knows. Every answer comes with a paper trail you are allowed to see.

Kiro is a permission-aware internal knowledge desk: ingest company documents, retrieve the right passages, and answer with citations.

## Frontend design system

The design direction is **trustworthy and calm**: sage surfaces, teal actions, and clearly marked evidence. See [DESIGN.md](DESIGN.md) for tokens, typography, layout, and component guidelines.

Run `pnpm --filter @kiro/web dev` and open [the live design system](http://localhost:3000/design-system) to review shared components and example screens in light and dark themes. The reference page works without backend services.

## Run it locally

```bash
cp .env.example .env
# Optional but recommended: set AI_LLM_API_KEY for embeddings + synthesized answers

pnpm infra          # postgres (5433) + redis only — avoids port clashes with pnpm
pnpm setup          # install deps, run Prisma migrations, install AI Python packages
pnpm dev            # web :3000 · api :3001 · ai :8000
```

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

1. Register a workspace at http://localhost:3000
2. Click **Load Northwind demo**
3. Wait until the UI says knowledge is ready (embeddings finish in the background)
4. Ask: “What is our refund policy?”

## Deploy to production

See **[docs/DEPLOY.md](docs/DEPLOY.md)** for the full step-by-step: accounts to create, VPS setup, env secrets, HTTPS, and launch checklist.
