# Organization and connected applications

The Spring Boot API and web app provide departments, teams, dated team memberships, multiple reporting managers, configurable roles, and scoped role grants. Reporting cycles and cross-tenant references are rejected. Changes are recorded in an organization audit log. Open **Company dashboards → Organization & access** as an administrator to configure them.

## Access and dashboards

Roles select a dashboard type and explicit permissions: `PROJECT_READ`, `PROJECT_WRITE`, `ORG_MANAGE`, and `INTEGRATION_MANAGE`. Bind a role at company, department, or team scope. Management permissions require company scope. Editing role permissions or revoking a grant takes effect on subsequent requests. Reporting relationships describe the organization; they do not independently grant project access.

Existing projects remain restricted. Project owners can select a team and enable organizational access in Work & insights. Restricted projects still require ownership or an explicit project grant. An administrator has setup access, but does not automatically gain business-data access or a CEO dashboard. Team membership grants read access to organizationally shared team projects; write permission requires an explicit write grant or a scoped role.

| Dashboard | Content |
| --- | --- |
| Employee — My workday | Own assigned tasks, deadlines, blocked work and observations |
| Manager — Team delivery | Team summaries, assignee workload, reporting relationships and projects |
| Director — Department delivery | Department and team rollups, project portfolio and risks |
| VP — Department portfolio | Department rollups, unassigned work, missing estimates and known remaining hours |
| CEO — Company overview | Department portfolio, authorized cross-department dependencies and recorded risks |

Every view applies current project access before aggregating. A title does not bypass scope. Remaining hours count recorded estimates only; there is no inferred employee availability, financial forecast, or organizational objective model. Tables show bounded recent results while dashboard totals aggregate the authorized scope. Organization setup currently caps directory results at 500 and membership/reporting results at 1,000; large-directory pagination is future work.

## Add credentials later

Connections can be saved without credentials. They remain `UNCONFIGURED` and do not contact providers. When ready:

1. Generate a server encryption key with `openssl rand -base64 32` and set `INTEGRATION_ENCRYPTION_KEY` in the API environment. Compose passes this variable through. Keep this key stable and backed up; replacing it requires reconnecting existing accounts.
2. Open **Company dashboards → Connected applications** with integration-management permission.
3. Save the resource configuration, then enter the credential through its password field. Credentials are encrypted with AES-256-GCM, bound to the tenant and connection, and never returned by list/read APIs.
4. Synchronize and review the run status and imported records. Multiple pages continue through the background scheduler. Add production credentials only to the intended deployment, not a disposable QA environment.

| Provider | Configuration and credential | Imported data |
| --- | --- | --- |
| GitHub | `owner/repository`; fine-grained token with selected-repository Issues read and appropriate Pull requests read access | Issues and pull requests returned by the repository issues endpoint |
| Slack | Joined public channel ID and workspace subdomain; bot token with `channels:read`, `channels:history` | Channel messages; excludes private channels, DMs and thread replies |
| Linear | Team UUID; personal API key authorized for that team | Team issues |
| HubSpot | Portal ID; private-app token with `crm.objects.deals.read` | Deal name, stage, amount and currency |
| Xero | Xero tenant UUID; OAuth access token with `accounting.transactions.read` | Invoice number, status, total and currency |
| BambooHR | Company subdomain; API key with directory access | Shared employee directory, job title, department and supervisor reference; no payroll or compensation |
| Google Analytics 4 | Numeric property ID; OAuth access token with `analytics.readonly` and property access | Sessions, key events and revenue by first-user campaign for 30 property-local reporting dates, ending two UTC dates ago |

These are real HTTP adapters, not simulated production connectors. They use fixed provider hosts, bounded requests, pagination, persisted cursors, encrypted credentials, retries, and rate-limit handling. Google Analytics calls the [Data API `runReport`](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport) using the [reporting API](https://developers.google.com/analytics/devguides/reporting/data/v1/basics). Its date window follows the GA4 property's timezone. An OAuth access token can expire and must currently be replaced manually; authorization redirects and refresh-token handling are not implemented. Delayed reporting and privacy thresholding can affect results. Official references: [GitHub](https://docs.github.com/en/rest/issues/issues), [Slack history](https://docs.slack.dev/reference/methods/conversations.history/), [Slack channel checks](https://docs.slack.dev/reference/methods/conversations.info/), [Linear](https://linear.app/developers/graphql), [HubSpot](https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/deals/guide), [Xero](https://developer.xero.com/documentation/api/accounting/invoices), [BambooHR](https://documentation.bamboohr.com/reference/get-employees-directory).

## Synchronization and limitations

- The scheduler checks due connections about once a minute and starts another full reconciliation after 15 minutes. Each job reads one page. Provider rate limits and request duration can delay progress.
- Stable external IDs make imports idempotent. Missing records are marked deleted only after a complete successful scan. Records are hidden during incomplete scans, after failures or disconnects, or after 24 hours without a successful scan.
- Connections and records are private to their creator, who must retain integration-management permission. Other administrators cannot read them. Revoked management permission stops scheduled imports. Disconnect removes the credential and cancels in-flight results; historical records remain stored but hidden. **Delete connection data** permanently removes imported provider records, finance/people/marketing facts, and explicit source links, then retains a scrubbed `DELETED` connection tombstone and audit event. Linked work tasks and approved-action audit records remain. This owner-scoped action cannot be undone.
- Provider records are private by default and separate from work projects and document search. A connection owner with project-write access can explicitly map supported issues, pull requests, tasks, and messages to a project. The flow records a provenance snapshot and requires confirmation before current project readers can see the source. Corrections and unlinking are audited; imported text never silently overwrites a task. Other provider records do not automatically populate role dashboards or enter model context.
- GitHub issue creation is available only through an approved action: the connection owner proposes exact content, a different project editor approves it, and the proposer explicitly confirms execution. Uncertain network outcomes are marked for manual verification and are not retried. Do not enable this for a connection without Issues write access. Other provider writes are not implemented. There are no signed webhooks, OAuth authorization redirects, or automatic token refresh. Xero expiry requires replacing the access token. Google Drive and S3 remain legacy stubs.
- The organization explorer reports scoped delivery and effort measures and allows bounded traversal among stored work/organization entities. It does not yet include CRM, finance, campaign, decision, or incident data. Capacity allocation and commitment hours are prorated evenly across their calendar windows; they are not measured utilization.
- Provider credentials were not supplied, so live provider authentication, scopes and account-specific responses remain unverified. Adapter tests use deterministic HTTP fixtures; PostgreSQL tests exercise actual persistence and authorization.

## Verification

The October 25 Java package passed 122 tests with no failures or skips, including Testcontainers PostgreSQL tests for owner-scoped permanent provider-data deletion. The live organization script passed against the rebuilt Java API and checks five role views, planning, graph/metrics scope, and provider-action permissions without calling a provider. The reference API passed 92 tests and the frontend transport suite passed 12. Frontend lint, typecheck and production build pass for this revision. The design reference was reviewed at desktop and mobile widths in both preview themes; the connection panel itself needs an authenticated API session for interactive visual verification. No production provider credentials were used, so external authentication and execution remain unverified.

Run Java 21/Maven with Docker available: `mvn -f apps/api-java/pom.xml package`. Testcontainers tests must execute, not skip. On Docker 29, an older Testcontainers client may require `JAVA_TOOL_OPTIONS=-Dapi.version=1.44`.

Run `pnpm --filter @kiro/web lint`, `pnpm --filter @kiro/web typecheck`, `pnpm exec turbo test --force`, and `pnpm --filter @kiro/web build`.

For a disposable running Java API, `ORG_E2E_URL=http://localhost:3201 ORG_E2E_ALLOW_MUTATION=1 python3 scripts/organization-e2e.py` creates synthetic accounts and verifies five dashboard views, scoped projects, reporting-cycle rejection, revocation, seven credential-free provider configurations, planning, graph/metrics scope, and approval-gated action behavior. It intentionally creates data; do not point it at a production workspace.
