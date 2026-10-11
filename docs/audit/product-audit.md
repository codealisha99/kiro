# Kiro product, ownership and production audit

Audit date: 2026-10-11. Outcome: improvements implemented across every discovered route and relevant shared composition. Accessible frontend states verified; signed-in workflows and default Java backend remain blocked by unavailable local infrastructure. This is not a declaration of full production readiness.

## A. Product identity

**Kiro** is a permission-aware internal company knowledge desk for employees, managers and administrators. Teams upload or paste documents, ask questions, review citations and source passages, revisit conversations, and inspect workspace health. Tenant isolation and document ACLs restrict retrieval. Keyword/extractive fallback exists; semantic search and synthesized answers need configured AI services.

The existing editorial direction is preserved: sage paper, forest ink, teal actions and terracotta evidence markers. The product is distinct from the maintainer's portfolio. Intended creator/maintainer attribution is **Alisha Karma / codealisha99**; human-readable credits identify current maintenance and do not claim sole historical authorship.

Architecture: pnpm 10.30.3 + Turbo; Next.js 15 App Router / React 19 frontend; Spring Boot / Java 21 / Maven default backend; retained NestJS backend for parity/reference; FastAPI AI service; PostgreSQL/pgvector and Redis. Flyway owns the Java migrations; Prisma belongs to the retained Node backend. No schema or API-contract changes were made.

## B. Design system

| Role | Light HEX | Dark HEX |
| --- | --- | --- |
| Canvas | #e3e7df | #14201e |
| Paper | #f2f4ee | #1c2b28 |
| Panel | #fafbf7 | #22332f |
| Raised | #ffffff | #293d37 |
| Ink | #172b29 | #eef2e9 |
| Muted | #596760 | #b2c2b7 |
| Border | #c4cdc2 | #455b50 |
| Action / info | #0a5c63 | #8accca |
| Evidence | #ad4121 | #f0a07c |
| Success | #246444 | #a3d3ae |
| Warning | #805411 | #edc580 |
| Danger | #a12f35 | #f2a4a8 |

Typography remains IBM Plex Serif for editorial reading, Outfit for interface controls, and IBM Plex Mono for metadata, with readable fallbacks and the existing swap-loading stylesheet. Tokens: 0.75, 0.875, 1, 1.125, 1.5 and 2rem; display scales from 2.5–4.5rem. Base text is 15px/1.5, answer text 17px/1.55.

Spacing follows a 4px rhythm through 64px. Controls/cards/dialogs use 8/12/20px radii; reading width is 680px, content width 1120px, and page gutters scale from 20–48px. New marker and danger foreground tokens correct dark-preview readability. Sampled contrast checks cover 20 foreground/background pairs, all above 4.5:1; this does not establish complete WCAG conformance.

Shared button/dialog styles were refined, dialog titles wrap, close controls retain their width, workspace reading widths now use centralized tokens, and keyboard skip links were added. Public navigation remains aligned with the product; the footer adds real maintainer, repository and email links. No unsupported settings, legal or billing pages were invented. `/design-system` now displays actual dark HEX values, danger color, and recovery-state examples.

## C. Route checklist

[Initial inventory](route-inventory.md), [browser evidence](browser-check.json), and [interaction evidence](interaction-check.json) distinguish source review from live verification.

| Route | Purpose | Design updated | Functionality tested | Responsive check | Status |
| --- | --- | --- | --- | --- | --- |
| `/` | Public product introduction | Footer, attribution and link accessibility refined | Example switching, source disclosure, FAQ and navigation | 320, 390, 768, 1440, 1600px | Accessible state verified |
| `/app` signed out | Sign in | Copy, validation, busy/error semantics refined | Password visibility, mode switch, network failure; successful login blocked | Same five widths | Form states verified; authentication success blocked |
| `/app?mode=register` | Create workspace | Copy and form handling refined | Fields inspected, native constraints and mode switch checked; registration success blocked | Same five widths | Form layout verified; persistence blocked |
| `/app` signed in | Ask/history/library/upload/reader/account | Width tokens, skip link, session recovery, library trigger and access guidance refined | Transport regressions tested; live workflows unavailable | Source inspection only | Implemented; signed-in verification blocked |
| `/admin` | Metrics and answer-quality evaluation | Access/retry panel, refresh, honest empty states, expandable diagnostics, session recovery | Signed-out access and navigation verified; real metrics/evaluations blocked | Five widths for signed-out state | Accessible state verified; authenticated state blocked |
| `/design-system` | Live component reference | Palette and recovery examples updated | Theme toggle and dialog keyboard behavior checked | Five widths in light and dark | Accessible reference verified |
| Unknown path, tested at `/missing-page` | 404 recovery | Branded screen implemented | Recovery navigation checked | Five widths | Verified |
| Root error boundary | Unexpected rendering failure | Branded retry screen implemented | Build/type checked; error not forced in live UI | Not exercised | Implemented; runtime recovery unverified |

The browser sweep contains 35 viewport measurements across seven states, with no page-level horizontal overflow, no missing local hash anchors, and no unlabeled form controls in those states. Axe Core found zero violations in its WCAG A/AA rule set after correcting the footer link. Incomplete/manual checks remain listed in the evidence; automated results do not certify accessibility.

Product workflow refinements: upload guidance clarifies that “Public” remains workspace scoped; search trims surrounding whitespace; document submission trims titles; repeat add-document requests can reopen the dialog; account summary shows the actual role. Session expiry clears workspace data and closes readers, and late requests cannot repopulate a different session. These changes retain real API calls and existing access rules. Signed-in drawer, upload, citation, sorting, conversation and feedback workflows still need live regression checks.

## D. Ownership and originality

No unrelated product identity was found in Kiro's visible source copy. Northwind and Helios references belong to intentional sample/example material; they are not presented as real customers. Aceternity and Hugeicons credits remain in `docs/ui-attributions.md`. The original cover image remains; its source and publication rights are unknown.

Corrected the placeholder repository clone URL, stale sample button text and outdated setup instructions. README, CONTRIBUTING, package metadata and CODEOWNERS identify the intended maintainer. Added a custom Kiro SVG favicon, accurate application metadata, route titles and no-index metadata for admin/design-reference pages. No unverified canonical domain was introduced.

GitHub read-only inspection confirmed `codealisha99/kiro` is public; its hosted description is empty and topics are unset. Remote metadata was not changed. Suggested description: “A permission-aware company knowledge desk with source-backed answers.” Suggested topics, if desired: `knowledge-management`, `retrieval-augmented-generation`, `nextjs`, `spring-boot`.

Initial working tree was clean, branch `main`, HEAD `53eecc5`; historical authors and commits remain intact. Existing local Git identity was inspected and left unchanged. No commit, push, remote change, permission change, deployment, DNS operation or production-data write occurred. No project license is declared; choosing one requires an explicit ownership/licensing decision.

## E. Code quality and security

Important changes are in semantic tokens/primitives, workspace and auth components, library/account composition, admin, design reference, recovery screens, metadata, transport, package manifests and lockfile, and maintainer documentation. Removed over 100 lines of unused legacy authentication CSS after checking component references. Preserved generated directives, security explanations, legitimate UI credits and migration history.

Separated `.next-dev` from `.next` and excluded generated development files from lint. This fixes dev/build output collisions without disabling source checks. Added seven tests of the actual frontend transport module using existing TypeScript and Node tooling, with no new test-framework dependency.

Dependency remediation: Next.js and matching ESLint config updated to 15.5.27; Multer updated to the patched 2.4 line; compatible transitive overrides cover proxy-addr, lodash, PostCSS, qs and body-parser. File-type and deepmerge-ts were patched after checking Node/module compatibility; PNG detection through the NestJS dependency path, nested merging through Prisma's dependency path, and Prisma generation passed.

`pnpm audit --prod` changed from **28 advisories (1 critical, 12 high, 13 moderate, 2 low)** to **1 moderate, no high/critical**. The remaining finding is NestJS core 10, patched in 11.1.18. It belongs to the retained reference backend. A NestJS 11 migration needs Express/API parity checks and is not silently forced into the Java-backend product audit. Full details are in [dependency-check.json](dependency-check.json); this scan excludes Maven and Python packages.

No tracked `.env` was found. No secret values were printed or included in evidence. Existing session storage, API contracts, callbacks, ACLs and migrations were preserved. Remaining production review items include the legacy NestJS development JWT fallback/wildcard CORS and browser-localStorage token storage; these are existing behaviors, not newly introduced guarantees of security.

Added `.github/workflows/verify.yml`: read-only, SHA-pinned official actions, frozen pnpm install, Prisma generation, type/lint/test/build checks, and Java 21 Maven tests. It has no deployment or publishing steps. YAML parsed locally; hosted execution remains unverified. Setup references: [official Node action](https://github.com/actions/setup-node/blob/main/README.md), [official Java action](https://github.com/actions/setup-java).

## F. Verification

| Check | Actual result |
| --- | --- |
| Baseline `pnpm typecheck` / `pnpm lint` | Passed |
| Baseline `pnpm test` | 71 tests passed; Jest worker teardown warning |
| Initial baseline build | Compiled, then failed during page collection because the concurrently started dev server shared `.next`; not classified as a pre-existing product failure |
| Final `pnpm typecheck` | Passed |
| Final `pnpm lint` | Passed, zero warnings |
| Final `pnpm test` | 78 passed: 71 NestJS + 7 frontend transport tests |
| Final `pnpm build` | Passed: shared package, retained API, Next production build |
| Prisma generation | Passed; no migrations applied |
| Python `compileall` | Passed for AI application sources; not AI integration testing |
| Browser inspection | Production build served on dedicated local port 3010; every accessible route visited |
| Axe / responsive checks | Zero reported A/AA violations in checked states; 35 viewport checks with no overflow |
| Contrast | 20 sampled semantic pairings passed 4.5:1 |
| Dependency audit | One moderate advisory; nonzero audit exit remains expected |
| Workflow YAML | Parsed and verification jobs/read-only permissions checked; remote jobs not run |
| `git diff --check` | Passed |

T3 preview explicitly reported no automation host; the local browse skill supplied Chromium. Port 3000 belonged to an unrelated project and was not counted as Kiro evidence. Source/asset HTTP checks and browser screenshots used port 3010.

Local API port 3001 was unavailable. Docker's daemon was stopped; Java runtime and Maven were absent. Therefore Java tests, PostgreSQL/Redis integration, successful authentication, RAG/AI-provider calls, uploads, persistence, ACL enforcement and authenticated visual states were not live-tested. `scripts/e2e-check.sh` was inspected but not run against production or an unknown database.

## G. Remaining work

1. Start disposable local infrastructure and install Java 21/Maven, then run Java tests and the live integration/ACL script. Verify every signed-in workflow and its responsive/mobile-drawer states.
2. Review the retained NestJS 11 migration if that backend will remain executable in production; resolve the remaining advisory through a tested framework upgrade.
3. Run the new hosted CI after an explicitly authorized commit/push. No remote CI result is claimed.
4. Confirm rights for the original cover image and decide the repository license before publication.
5. Approve any hosted repository description/topic changes separately. Product canonical/social-image configuration should use a confirmed product URL, not the maintainer portfolio.

No release, deployment, commit or publication is part of this audit.
