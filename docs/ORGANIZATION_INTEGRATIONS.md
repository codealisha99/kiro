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

These are real read-only HTTP adapters, not simulated production connectors. They use fixed provider hosts, bounded requests, pagination, persisted cursors, encrypted credentials, retries, and rate-limit handling. Official references: [GitHub](https://docs.github.com/en/rest/issues/issues), [Slack history](https://docs.slack.dev/reference/methods/conversations.history/), [Slack channel checks](https://docs.slack.dev/reference/methods/conversations.info/), [Linear](https://linear.app/developers/graphql), [HubSpot](https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/deals/guide), [Xero](https://developer.xero.com/documentation/api/accounting/invoices), [BambooHR](https://documentation.bamboohr.com/reference/get-employees-directory).

## Synchronization and limitations

- The scheduler checks due connections about once a minute and starts another full reconciliation after 15 minutes. Each job reads one page. Provider rate limits and request duration can delay progress.
- Stable external IDs make imports idempotent. Missing records are marked deleted only after a complete successful scan. Records are hidden during incomplete scans, after failures or disconnects, or after 24 hours without a successful scan.
- Connections and records are private to their creator, who must retain integration-management permission. Other administrators cannot read them. Revoked management permission stops scheduled imports. Disconnect removes the credential and cancels in-flight results; historical records remain stored but hidden.
- Provider records are separate from work projects and document search. They do **not** automatically populate role dashboards, grant organizational access, or enter model context. Mapping and sharing imported records requires a further explicit workflow.
- There are no provider write actions, webhooks, OAuth authorization redirects, or automatic token refresh. In particular, Xero access-token expiry requires replacing the token. Google Drive and S3 remain legacy stubs.
- Provider credentials were not supplied, so live provider authentication, scopes and account-specific responses remain unverified. Adapter tests use deterministic HTTP fixtures; PostgreSQL tests exercise actual persistence and authorization.

## Verification

The October 24 pass completed 100 Java tests with no failures or skips, 92 reference API tests, 12 frontend transport tests, frontend lint/type checking, and the production web build. Browser checks covered organization creation, credential-free connection creation, and a populated CEO view, with desktop/mobile layouts and both preview themes. The live organization script passed against the rebuilt Java API. No production provider credentials were used.

Run Java 21/Maven with Docker available: `mvn -f apps/api-java/pom.xml package`. Testcontainers tests must execute, not skip. On Docker 29, an older Testcontainers client may require `JAVA_TOOL_OPTIONS=-Dapi.version=1.44`.

Run `pnpm --filter @kiro/web lint`, `pnpm --filter @kiro/web typecheck`, `pnpm exec turbo test --force`, and `pnpm --filter @kiro/web build`.

For a disposable running Java API, `ORG_E2E_URL=http://localhost:3201 ORG_E2E_ALLOW_MUTATION=1 python3 scripts/organization-e2e.py` creates synthetic accounts and verifies five dashboard views, scoped projects, reporting-cycle rejection, revocation, six credential-free provider configurations, and audit entries. It intentionally creates data; do not point it at a production workspace.
