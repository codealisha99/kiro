# Kiro demo guide

## Start the default stack

Run from the repository root. Requires Docker with Compose; Node 20+ and pnpm 10.30.3 for local checks (Node 24 is used by the verification workflow). Python 3 is needed for the secret-generation command below. These commands are for a **fresh checkout**; preserve an existing `.env`.

```bash
pnpm install --frozen-lockfile
cp .env.example .env
python3 - <<'PY'
from pathlib import Path
import re, secrets
p = Path('.env')
p.write_text(re.sub(r'^JWT_SECRET=.*$', 'JWT_SECRET="' + secrets.token_hex(32) + '"', p.read_text(), flags=re.M))
PY
# Leave AI_LLM_API_KEY empty for keyword search/source extracts.
# Optional provider setup is documented in API_DEPENDENCIES.md.
docker compose config --quiet
docker compose up -d --build
docker compose ps
curl -fsS http://localhost:3001/health
curl -fsS http://localhost:8000/admin/health
```

Open http://localhost:3000. PostgreSQL is exposed on 5433; Redis on 6379. Use `docker compose logs --tail=80 api-java ai` for failures, keeping any sensitive output private. Stop with `docker compose stop` (preserves volumes). Do not start `pnpm dev` alongside Compose: the services use the same ports.

For a **UI-only presentation**, no backend or model credentials are required:

```bash
pnpm install --frozen-lockfile
pnpm --filter @kiro/web dev
# If 3000 is occupied:
KIRO_NEXT_DIST_DIR=.next-dev pnpm --filter @kiro/web exec next dev -p 3012
```

Only `/`, auth screens and `/design-system` work independently. The landing example is illustrative and must not be presented as a live AI response.

## Main demo (about 3 minutes)

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open `/app?mode=register`; enter a new workspace, email and password (8+ characters). | Signed in as the workspace's first admin. Use a unique email for repeat demos. |
| 2 | Open **Library → Try with sample documents**. | Fictional Northwind handbook documents appear; embedding preparation may remain pending without a provider. |
| 3 | Ask **“refund policy”**. | Evidence from **Customer refund policy**: 30 days after delivery for unused packaged goods; digital products: 14 days if under 10% accessed. With no provider, expect labelled source extracts rather than a synthesized answer. |
| 4 | Open a source citation, then full document. | The exact retrieved passage and its surrounding content are readable. |
| 5 | Library → Add document → text. Title: **Demo travel policy**; content: **Travel reimbursement requires a receipt. Submit claims within 14 days.** | Saved document appears; search for its title, then ask **“travel reimbursement”** and inspect its citation. |
| 6 | Open account profile; visit the admin overview, then sign out and log back in. | Actual role and service status; session changes clear private UI data. |

Optional isolation demo: register a second workspace with a different email; its Library should not contain the first workspace's documents. Demo seeding also creates an employee viewer account; retrieve its credentials from the local seed response if needed, rather than hard-coding them in slides. Demo records are not real customer data.

## 60-second pitch

“Kiro turns company documents into a knowledge desk. Instead of remembering which handbook or project note contains an answer, a teammate asks a question and follows the response back to the source. We can load a sample handbook, ask about refunds, and open the passage that supports the answer. Documents remain scoped to their workspace and access rules are applied before retrieval reaches the model. When a model is unavailable, Kiro still offers keyword search and clearly labelled source extracts. When the documents contain no evidence, it says so. The core workflow is implemented; live Drive, Slack and CRM sync are still stubs. This demo shows document ingestion, retrieval and evidence—not an unsupported integration.”

**Technical explanation:** Next.js talks to a Spring Boot REST API. PostgreSQL stores accounts, versions, chunks and citations; Redis handles sessions and embedding jobs. FastAPI calls an optional OpenAI-compatible model provider. SQL access predicates filter evidence before keyword/vector rank fusion and generation.

## Checks and common failures

```bash
pnpm --filter @kiro/api prisma:generate  # generated client only; no migration
pnpm typecheck
pnpm lint
pnpm test
pnpm build
python3 -m compileall -q apps/ai/app
# With Java 21 and Maven:
mvn -f apps/api-java/pom.xml test
# Only against a disposable local stack; creates accounts/documents:
API_URL=http://localhost:3001 bash scripts/e2e-check.sh
```

| Symptom | Check / next action |
| --- | --- |
| Containers cannot start | Start Docker; free ports 3000/3001/8000/5433/6379. |
| Database/migration errors | Require pgvector; use separate Java and legacy databases. Do not reset valuable data. |
| Registration/query fails | Check API health, JWT secret and Redis; `NEXT_PUBLIC_API_URL` must match the browser-reachable API; Java uses `CORS_ORIGINS`. |
| Search preparation stays pending | Missing/invalid provider key or embedding failures; keyword retrieval still uses saved text. Check admin failures. |
| No answer or partial extract | Use exact document terms; provider-free FTS matches all non-stop query terms. Extractive fallback can truncate passages. |
| AI health is OK but no generated answer | Liveness does not verify credentials; inspect `/gateway` on the local AI service. Models and billing must be enabled. |
| PDF contains no text | No OCR; use selectable-text PDF or paste text. |

**This pass:** all Node checks (78 tests), Compose config and Python compilation passed. Frozen installation with lifecycle scripts disabled, documented shell syntax, local documentation links and the secret-generation recipe were also checked. Public example switching was exercised on port 3012; registration and design-reference routes returned HTTP 200; the browser host then disconnected. Full registration, ingestion, source reader, ACL and paid-provider demo were blocked by missing Docker daemon/Java/Maven/local API. The E2E script was not run against an unavailable or production backend.
