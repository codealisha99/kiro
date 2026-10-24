# Product audit — 2026-10-12

Kiro is a company knowledge desk. The useful core is real ingestion, permission-filtered retrieval, source-backed answers, readable evidence, and saved conversations. The established editorial design remains intact. Changes in this audit stay local; no commit, push, PR, release, or deployment is authorized.

## Scope and implementation status

| Surface | Existing behavior | Audit outcome |
| --- | --- | --- |
| `/` | Public introduction, illustrative example switching, citation expansion, FAQ, registration/sign-in links | Preserve the clearly labeled illustration; check desktop/mobile layouts |
| `/app` authentication | Workspace registration, sign-in, password visibility, session recovery | Verify real registration and authorized workspace loading |
| Ask Kiro | Questions, follow-ups, cited answers, provider-free extracts, retry, feedback | Preserve citation numbers and exact cited chunks; bound stalled requests |
| Saved conversations | User/tenant-scoped history | Add title search; recheck current document access and withhold cached answers when evidence is unavailable |
| Library | Title/source search, classification filters, sorting, file/text ingestion, sample corpus | Reject whitespace-only text; freeze fields while saving; distinguish creation, updates, and unchanged content |
| Document reader | Citation excerpt and latest full document | Read exact historical versions, edit authorized documents with concurrency protection, and remove documents with confirmation and recovery |
| Account | Real identity, role, sign-out, administrator link | Preserve real account data and clear stale document/feedback state across sessions |
| `/admin` | Metrics, retrieval/answer evaluations, access and retry states | Preserve existing service failure visibility; check real administrator view |
| `/design-system` | Shared primitives and light/dark previews | Update the upload reference for supported Office formats; preserve semantic tokens |
| Recovery | Error boundary and not-found page | Preserve established recovery screens; check not-found routing |

Java/Spring Boot is the default API. NestJS remains a reference implementation; both receive the evidence/access fixes. FastAPI provides model calls when configured. Drive, Slack, CRM and S3 connectors remain stubs. Landing examples are illustrative. No external services were provisioned or represented as operational.

## Problems fixed

1. **Saved evidence bypassed current permissions.** Conversation ownership checks did not recheck document access. Both APIs now withhold the whole answer and all source metadata if any supporting document was deleted or access was revoked. Removing only the citation would still expose facts in the cached answer.
2. **Citation numbering could point at the wrong passage.** Sparse citations such as `[2]` lost their numbers when the source list was filtered. New evidence records preserve the original number and exact chunk; the UI resolves by that number. Uncited chunks from the same document are no longer saved as evidence.
3. **Superseded knowledge could answer new questions.** Both keyword and semantic retrieval now choose the latest approved version per document. Historical citations remain available while access permits, with a warning when the reader shows a different current version.
4. **Duplicate ingestion could alter another person's document.** Ownership/admin authorization is checked before changing an existing document's title, classification, or deletion state. The reference API uses separate create/update operations so concurrent duplicate creation cannot update an unchecked owner.
5. **Requests could stay pending indefinitely.** Ordinary requests, including sign-out and feedback, have a 20-second deadline; generation, ingestion, and revision saves have 120 seconds. Deadlines include reading the body. No writes are automatically retried; timeout guidance explains that server work might already have completed.
6. **Redis outages caused a hot worker loop.** The Java embedding workers now back off for one second after a polling failure and honor interruption.
7. **Advertised Office uploads were blocked in the UI.** The shared upload control accepts DOCX/XLSX as well as PDF/CSV/Markdown/text. Java rejects corrupted workbooks instead of indexing binary garbage.
8. **Access and completion labels were misleading.** Existing restricted documents display “Restricted,” since a reader may have an explicit grant. Upload success distinguishes a new document, a changed version, and unchanged content.

## Enhancements selected

| Enhancement | User value | Complexity and dependencies | Limits |
| --- | --- | --- | --- |
| Conversation title search | Find a past question without scrolling the sidebar | Small, uses already loaded personal history | Searches loaded titles; no full-text answer search |
| Version history | Read the actual full text behind an older answer | Moderate, adds permission-checked version endpoints to both APIs | Titles/access reflect the current document; content and filenames come from the selected version |
| Document revisions | Correct knowledge without creating a duplicate document | Moderate, transactional save with row locking and expected-version checks | Text editing preserves access; earlier files/versions remain intact; it does not edit original Office formatting |
| Authorized removal | Keep accidental or obsolete documents out of answers | Moderate, uses existing soft-delete API and server-derived permission | Explicit confirmation; no desk undo; underlying records are retained |

## Database compatibility

The new `citationIndex` column is nullable and additive. Java applies `V3__evidence_citation_index.sql` through Flyway when starting against its database. The reference NestJS API requires its new Prisma migration, followed by Prisma generation. Do not run legacy Prisma migrations against a Java/Flyway database.

No existing workspace database was migrated during this audit. Live checks use disposable PostgreSQL/Redis containers without existing volumes. Old evidence records retain their positional fallback; their original numbering cannot be reliably reconstructed and is not retroactively changed.

## Remaining limitations

- No configured model provider was used during live checks. Keyword search and explicitly labeled extracts were exercised; live model generation and embedding quality remain unverified.
- The NestJS reference parser still lacks proper ZIP-based Office extraction; use the default Java backend for DOCX/XLSX. It must not be treated as production parity.
- Connector synchronization, group membership, password reset, team administration UI remain outside the implemented workflows. API user creation is not an email invitation service.
- Removal is a soft delete, not a data-erasure feature. Permission changes affect subsequent server reads; they cannot erase information a person has already received.
- Tokens remain in browser local storage, and embedding preparation status is workspace-wide. Production authentication/storage policy and provider readiness need further review.
- The cover photograph's publishing rights and a project license remain unresolved as documented in `OWNERSHIP.md`.

## Verification

- Node suites: 92 reference API tests and 12 frontend transport tests passed. The final three historical-reader tests were run through `pnpm --filter @kiro/api test --runInBand`.
- `pnpm lint`, `pnpm typecheck`, and `pnpm build`: passed. The production build generated every web route.
- Java 21/Maven tests run through the cached local Docker image: 73 passed, zero failures/errors/skips, including PostgreSQL/Flyway integration tests. Docker API compatibility required `-Dapi.version=1.44` for the existing Testcontainers version.
- Real browser/API workflows: registration, first-document onboarding, whitespace validation, text ingestion, provider-free keyword answers, citation reading, feedback, conversation search, version metadata, removal cancellation/confirmation, library refresh, and saved-answer redaction after removal passed.
- Additional live checks passed DOCX upload with real parsed content, denied removal by a reader, rejection of another owner’s duplicate-content reclassification, and saved-answer redaction after an explicit access revocation. The source reader was inspected at desktop/mobile widths in both themes.
- Browser layout checks covered `/`, `/app`, `/admin`, `/design-system`, and an unknown route at 1280px and 390px in light and dark preview themes. No horizontal overflow or browser runtime errors occurred. Screenshots of the answer and source reader were inspected.
- `git diff --check`: passed. Existing database volumes were never attached to test containers.

Local-only browser screenshots and Java test output are stored under `/tmp`, not published. The collaborative browser disconnected during testing; a local headless browser completed the checks.


## Continuation: document revisions and historical reading

- Added `PATCH /documents/:id` to both APIs. Saves require the expected current version, use a document row lock, reject competing stale edits with HTTP 409, and create immutable approved revisions. Unchanged saves do not create a version. Revision text is limited to 400,000 characters and titles to 200 characters.
- Owners, workspace administrators, and explicit user ADMIN grantees can edit documents they can read. Reader/WRITE grants do not authorize this management action. Editing preserves classification and ACLs. Version history uses the current document's access rules, including revocation and deletion checks.
- Added `GET /documents/:id/versions/:version`; citation clicks now request the exact cited version. Legacy versions without stored full content reconstruct their ordered chunks. Unknown versions return 404 instead of substituting current text.
- Added a text editor with validation, unsaved-change confirmation, preserved drafts after conflicts, current-text comparison, and explicit continuation from a reviewed version. Saving changes the knowledge used in future answers while leaving earlier evidence readable.
- Added `closeDisabled` to the shared dialog. Pending writes disable close, Escape, and backdrop dismissal. The live design reference includes an explicitly simulated pending-save example.
- Added PATCH to the Java CORS allowlist and tested the real browser preflight path.
- Live PostgreSQL/browser checks passed editing, version switching, historical citation highlighting, conflict comparison/reconciliation, retrieval of revised knowledge, simultaneous saves (one HTTP 200 and one HTTP 409), denial of reader edits, and recovery of dialog dismissal after a pending save.
- Editor screenshots were inspected at 1280px and 390px in light/dark themes. No horizontal overflow or browser runtime errors occurred.

These additions use the existing document/version tables and require no further database migration beyond the citation-index migration from the first pass. Local test services were isolated from existing volumes and removed after verification.
