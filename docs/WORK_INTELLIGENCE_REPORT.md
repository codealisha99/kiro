# Organizational intelligence engineering report — 2026-10-24

## Scope and initial audit

The repository and public product are **Kiro**. They have not been renamed. This session began with substantial uncommitted work: document revisions/security fixes, the V3 citation migration, the V4 work model, a work dashboard, work service tests, and a live API test script. Those changes were preserved. This report distinguishes that starting implementation from the insight-triage work added in this session.

The current stack is a pnpm/Turbo monorepo: Next.js 15/React 19 frontend, default Java 21/Spring Boot 3 API, PostgreSQL/pgvector with Flyway, Redis sessions/embedding jobs, and a Python FastAPI model service. The retained NestJS/Prisma API is a reference backend; it does not implement the work module. Do not apply Prisma migrations to the Java database.

Existing capabilities inspected:

- Registration/login, JWT authentication, durable session checks and Redis session markers; tenant-scoped users. Login chooses the first matching email/password identity across tenants; explicit organization selection remains a gap.
- Document ingestion, approved versions, ACL-aware keyword/vector retrieval, RAG with evidence, conversation history, revision editing and removal. The model service is optional for structured work.
- Additive structured work tables for projects, explicit grants, tasks, dependencies, immutable events, insights, scenarios and scenario evidence. Cross-tenant foreign keys and query predicates enforce isolation. An organization administrator does not automatically get project access.
- Recursive authorized dependency impact queries, cycle prevention, immutable task snapshots, deterministic metrics, scheduled overdue/blocked/unassigned detection, and user-assumption-based project capacity scenarios.
- `/app` Work & insights consumes those APIs with loading, empty, failure, paging and evidence states. It is a shared project-access dashboard, not separate employee/manager/director/VP/CEO dashboards.
- Drive, Slack and CRM are stubs with unconfigured health; synchronization rejects them. There is no verified real external integration, OAuth flow, synchronization cursor/retry framework, or normalized provider-event pipeline.
- Redis embedding workers, application metrics/health, tests using H2 and PostgreSQL Testcontainers, and a Docker Compose deployment. Work insights use database polling and immediate evaluation after task writes.

Baseline: the existing Node suites passed via Turbo cache. The Java baseline passed 80 tests, including five work PostgreSQL tests. The work layer functioned, but users could only inspect observations and fix the underlying task: acknowledgement/dismissal/reassessment were missing. The README's earlier verification counts and “Java unavailable” statement were stale.

Implementation decision: complete the evidence → review → source correction → resolution workflow in the current Java module and dashboard. Preserve existing authentication, RAG, schema and design. Do not introduce another service, database or speculative integration.

## Changes made in this session

| File/module | Change |
| --- | --- |
| `apps/api-java/src/main/resources/db/migration/V5__insight_triage.sql` | Add triage status, reason, actor, timestamp and version; constrain status, tenant-scoped actor identity and mandatory dismissal reason. Existing insights default to OPEN. |
| `work/WorkDtos.java`, `work/WorkController.java` | Validated `POST /work/insights/{id}/triage` with status, optional reason and required expectedVersion. |
| `work/WorkService.java` | Enforce project WRITE access, serialize against source writes, reject stale or resolved changes, append immutable INSIGHT_TRIAGED events, reopen unresolved reviewed observations when source tasks change and append INSIGHTS_REASSESSED events. |
| `apps/web/src/lib/work-api.ts` | Typed triage metadata and transport method. |
| `apps/web/src/components/WorkDashboard.tsx` | Persisted review badges; acknowledge/dismiss/reopen controls in evidence dialog; required dismissal reason; pending-write dismissal protection; visible API errors. Reuses existing primitives and semantic styles. |
| `work/WorkPostgresTest.java` | Two additional database tests for permissions, revocation, reason validation, stale versions, deduplication, history, source reassessment, resolution and recurrence. |
| `scripts/work-e2e.py` | Extend real HTTP checks for triage validation, permission denial, audit persistence, conflicts and rejecting changes to resolved observations. |
| `README.md`, this report | Current verification and operational/remaining-work guidance. |

No shared UI primitive changed. No new provider or external action was implemented. V3/V4 and the pre-existing work module remain in the working tree; V5 is the migration added in this session.

Review state and detected-condition state are intentionally separate. Dismissal does not falsify the risk or suppress it from history. Repeated evaluations preserve dismissal. Editing the source task reopens any still-active reviewed observations; resolving the condition retains its triage history. A recurring condition gets a new insight identity. Original evidence remains the first observation's snapshot, with its version explicitly displayed.

## Verification

| Check | Result |
| --- | --- |
| Java `mvn -q -Dapi.version=1.44 package` in cached Java 21/Maven container | **82 tests, 0 failures, 0 errors, 0 skipped**; executable JAR built. Includes seven work PostgreSQL tests. |
| Flyway with disposable PostgreSQL/pgvector | All **five migrations** applied successfully to clean databases; application also started against a separate empty test database. |
| `pnpm lint` | Passed. |
| `pnpm typecheck` | Passed. |
| `pnpm build` | Passed; Next.js production routes generated and reference API build successful. |
| `pnpm exec turbo test --force` | **92 reference API tests + 12 frontend transport tests passed**, without Turbo test-cache reuse. |
| `WORK_E2E_URL=http://localhost:3102 WORK_E2E_ALLOW_MUTATION=1 python3 scripts/work-e2e.py` | Passed: registration/login, unauthenticated denial, validation, tenant isolation, explicit grants/revocation, scoped metrics/insights/history, read-only triage denial, cross-tenant denial, dismissal validation, audit persistence, stale triage rejection, concurrent task saves (200/409), automatic insight resolution, scenario calculation/access denial, logout invalidation. |
| Collaborative browser | Real registration and project creation, empty work view, API-created synthetic blocked/overdue task displayed in metrics and insight center, evidence opening, disabled reasonless dismissal, persisted dismissal/reason, acknowledgement and refreshed badges passed. |
| Responsive/theme checks | Insight evidence inspected at 1280×800 and 390×844 in light and dark previews; no document/dialog horizontal overflow. |
| AI outage | Test API used an unavailable AI service. Structured work, triage and scenario checks passed independently of it. |
| `git diff --check` | Passed. |

Java command used in this environment (no host Maven required):

```sh
docker run --rm \
  -v "$PWD/apps/api-java:/build" \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal \
  kiro-java-test mvn -q -Dapi.version=1.44 package
```

`kiro-java-test` was an existing local image with Java 21/Maven dependencies cached, not a published artifact. With a normal Java 21/Maven installation, use `mvn -f apps/api-java/pom.xml test`. PostgreSQL tests require Docker and can skip when Docker is absent; check the skip count. `api.version=1.44` was needed for the installed Testcontainers/Docker combination.

Limits: browser checks cover the changed work/evidence surface, not every application route or all requested organizational roles. Live model generation, provider ingestion and policy-answer quality were not exercised in this session; existing RAG/ACL unit and integration tests passed. Early browser attempts hit an unrelated service on port 3000 and then the test API before startup; final checks used the isolated web/API at 3100/3102. No existing project database or unrelated running service was modified.

## Functional status against the requested platform

| Capability | Status |
| --- | --- |
| Explicit project access, tenant isolation, optimistic task edits | Implemented and verified in the existing work slice. |
| Work metrics and evidence-backed overdue/blocked/unassigned rules | Implemented and verified; manual structured data only, no utilization inferred without availability. |
| Insight acknowledgement/dismissal/reassessment/audit | Implemented and verified in this session. Assignment, notifications, outcome tracking and configurable thresholds remain absent. |
| Dependency graph and temporal task history | Partially implemented: authorized task dependencies, cycle rejection and immutable snapshots verified. No organization-wide entity graph, goals, decision graph or temporal query language. |
| Scenario planning | Partially implemented: bounded single-project effort calculation and saved evidence verified. No scenario comparison UI, skills matching, cross-project capacity, forecasting or execution. |
| Authentication and organizational authorization | Partially implemented: current sessions and explicit project ACLs verified. Configurable roles, departments, teams, reporting hierarchy and sensitive-record policies remain missing. |
| Role-specific organizational dashboards | Not implemented. Existing dashboard is project-access scoped. |
| Documents/RAG | Existing implementation preserved; regression tests pass. Live provider-backed generation/embedding quality is unverified and requires configuration. |
| Structured conversational intelligence | Not implemented. Brain query still routes through RAG. |
| Real integrations and event normalization | Not implemented. Stub connectors report unconfigured; credentials alone will not make them functional. |
| Approval requests and consequential action execution | Not implemented. Triage is an internal review action, not approval to modify external systems. |
| CRM/marketing/finance/HR analytics | Not implemented. No fabricated data or provider status added. |
| Production hardening | Partial: existing validation, session checks, health and logs retained. Reliable provider jobs, retention, organization provisioning, recovery drills and broader security review remain. |

## Next implementation steps

1. Add departments, teams, memberships/reporting scope and configurable permission bindings with tenant-composite foreign keys. Extend the existing project visibility policy rather than adding a second authorization system. Prove revocation across aggregates, graph traversal, history, cached evidence and AI inputs before exposing broader dashboards.
2. Implement one real authorized provider ingestion slice: connection metadata, encrypted credential reference, declared capabilities, source records/events, sync runs/cursors, idempotency constraints and deletion/permission-change behavior. Add pagination, bounded retries and rate-limit tests. No provider connection was requested or provisioned here.
3. Map normalized work records to existing projects/tasks with explicit stable identifiers; preserve uncertainty for unverified links. Add source links and freshness to metrics/insights.
4. Add declared availability and planning windows, milestones/goals and cross-project commitments. Only then calculate utilization and implement different organizational-role dashboards.
5. Add a constrained orchestration service selecting authorized structured tools versus RAG; test that unauthorized facts never reach the model and that provider outages leave core tools usable.
6. Extend scenarios with versioned assumptions, comparisons and recommendation/approval/action records. Reauthorize and revalidate versions at approval/execution time; make external mutations idempotent and auditable.
7. Expand provider and departmental metrics only when real authorized data and explicit metric definitions exist. Add full end-to-end coverage for the remaining acceptance criteria.

These gaps are implementation work, not merely missing credentials. The full requested platform is not complete.

## Local operations

Prerequisites: Docker Compose; pnpm 10.30.3 and a compatible Node runtime; Java 21/Maven for host backend development.

```sh
pnpm install --frozen-lockfile
# Fresh checkout only: copy .env.example to .env; preserve any existing .env.
# Set JWT_SECRET to a generated secret of at least 32 bytes.
docker compose up -d --build
```

Open `http://localhost:3000/app`, register a disposable development workspace, and select **Work & insights**. Flyway applies V1–V5 at Java startup. No migration reset or seed is needed. Use **Create project**, add tasks, then inspect and triage generated observations. A task marked BLOCKED, unassigned and overdue will generate the three corresponding observations. Marking it DONE resolves them. Use an explicit “Synthetic” project name for demonstrations.

The work module is Java-only: `pnpm dev` starts the legacy reference API and is not sufficient. To develop the web against the default Java API:

```sh
NEXT_PUBLIC_API_URL=http://localhost:3001 pnpm --filter @kiro/web dev
```

Avoid conflicting with the Compose web container on port 3000. Core work requires PostgreSQL and Redis/authentication but does not require LLM credentials. Optional AI configuration is documented in `.env.example`; live connector synchronization remains unavailable.

Tests:

```sh
pnpm --filter @kiro/api prisma:generate
pnpm lint
pnpm typecheck
pnpm exec turbo test --force
pnpm build
mvn -f apps/api-java/pom.xml test
# Only against a disposable local Java API (creates synthetic organizations/users):
WORK_E2E_URL=http://localhost:3001 WORK_E2E_ALLOW_MUTATION=1 python3 scripts/work-e2e.py
```

The live test script deliberately requires mutation opt-in and does not delete its test organizations. Use a disposable database; do not point it at an existing company workspace. No test credentials are needed from an external service.

## Final state

The repository builds and the application was run against a clean isolated database. The operational project/insight workflow above was verified. All changes remain uncommitted, unpushed and undeployed. Existing uncommitted changes were preserved. Disposable services created for this session are removed after verification; pre-existing services remain untouched.
