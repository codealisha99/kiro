# Ownership and branding audit — 2026-10-12

## Identity and scope

Canonical creator and primary maintainer: Alisha Karma / `codealisha99`; https://github.com/codealisha99, https://alishakarma.com, public contact lishykarma99@gmail.com. Product branding remains Kiro. Initial branch `main`, HEAD `0d82bf6`, working tree clean. No user edits were present or overwritten.

## Inspection

Reviewed all five package manifests, Java POM, README and Java README, CONTRIBUTING, CODEOWNERS, DESIGN, architecture/API/migration/deployment documentation, UI attribution guide, both GitHub workflows, Docker configuration, environment example, application metadata/footer, custom mark, favicon and public assets. No LICENSE, changelog, Python project manifest, Cargo manifest or release-author file is present. Searches distinguish authentication terminology, demonstration/test fixtures, framework names and genuine third-party credits from author identity.

## Corrections

| Files | Reason |
| --- | --- |
| Root and four workspace package.json files | Canonical creator/contact; monorepo package repository directories; dependency versions unchanged |
| apps/api-java/pom.xml | Explicit maintainer identity and contact; consistent Kiro description |
| README.md | Custom Kiro wordmark replaces unverified cover image; correct Flyway/Prisma explanation; ownership guide link |
| docs/OWNERSHIP.md | Identity, historical provenance, license limitations, brand assets and future commit guidance |
| DESIGN.md | Mark proportions, portable wordmark, semantic colors and brand usage |
| apps/web/src/app/icon.svg | Same geometry as the existing application mark |
| apps/web/public/brand/*.svg | Reusable transparent mark and documentation wordmark; accessible titles |
| apps/web/src/app/design-system/page.tsx and design-system.css | Actual mark in navigation; themed brand reference and asset link |
| apps/web/src/app/layout.tsx | Canonical creator profile in author metadata |
| This audit | Evidence, access limitations and results |

Existing CONTRIBUTING/CODEOWNERS/footer attribution was already correct and is preserved. All original third-party UI credits remain; package licenses and historical commits were untouched. No exclusive source-authorship claim or artificial contributor list was added.

## Git and GitHub

Authenticated GitHub account: `codealisha99`. Repository `codealisha99/kiro` is public, default branch `main`, description empty, topics unset; main reports `protected: false`. These settings, remotes and permissions remain unchanged. Existing Git author labels across all refs: `codealisha99` (39), `alisha` (3), `T3 Code` (25). These are commit labels, not verified human identities.

Local Git name/email remain unchanged. Reading authenticated email settings failed because the token lacks the required user scope. No noreply email was guessed, private account data requested through new authorization, or Git history rewritten. The previous audit was subsequently committed and pushed at the user's explicit request; this new audit makes no commit or push.

The hosted `CI` and `Verify Kiro` workflows for `0d82bf6` both completed successfully. New local changes have not run on hosted CI. Suggested hosted description: “A permission-aware company knowledge desk with source-backed answers.” Changing hosted metadata remains a separate action.

## Verification

Executed `pnpm install --lockfile-only --ignore-scripts` (no lockfile change), `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build`: all passed. Tests: 71 NestJS plus 7 frontend transport tests. Re-ran type/lint/build after the final metadata/CSS edits. SVG/XML parsing and five package identity checks passed. `git diff --check` passed. No dependencies added or changed.

Collaborative browser loaded the actual dev server on port 3012. The design reference was checked at 1280×800 and 375×812, both light and dark: no horizontal overflow; the mark uses semantic teal (light #0a5c63, dark #8accca), and the wordmark uses the editorial font. Theme buttons worked; SVG wordmark route loaded with the correct title and viewBox. Screenshot/snapshot capture failed twice in the browser tool; DOM, layout measurements and interaction checks succeeded. Full visual screenshot review is therefore not claimed.

Java/Maven tests were not executed locally: Maven is unavailable and the macOS Java launcher has no installed Java runtime. The previous hosted Java checks passed, but that is not execution of the newly edited POM. Backend contracts, data, migrations and authorization code were not modified.

## Remaining limitations

No project license is declared; choosing one requires the rights holder. The retained cover photograph's provenance/rights are unknown. Verified future commit email cannot be established with the current token. Hosted description/topics are blank and main is unprotected; no settings were changed. Both workflows overlap; consolidation is a future engineering option, not an authorship correction. No trademark or product domain ownership claim was made.
