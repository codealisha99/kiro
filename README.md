![Kiro](apps/web/public/cover.png)

# Kiro

Ask what the company knows. Every answer comes with a paper trail you are allowed to see.

Kiro is a permission-aware internal knowledge desk: ingest company documents, retrieve the right passages, and answer with citations.

## Run it locally

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001
- AI service: http://localhost:8000
