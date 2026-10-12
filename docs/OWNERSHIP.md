# Kiro ownership and brand guide

Kiro is the product name: a permission-aware company knowledge desk with source-backed answers. Its creator and primary maintainer is **Alisha Karma**, GitHub **[codealisha99](https://github.com/codealisha99)**.

- Website: https://alishakarma.com
- Public maintainer contact: lishykarma99@gmail.com
- Project repository: https://github.com/codealisha99/kiro
- Review ownership: `.github/CODEOWNERS`

Package author metadata identifies the project's creator and current maintainer; it does not assert exclusive authorship of every file. The same maintainer identity applies to the web frontend, retained NestJS API, Java API, AI service, and shared types.

## Historical and third-party attribution

Historical commit authors are preserved in Git. The 2026-10-12 audit found author labels `codealisha99`, `alisha`, and `T3 Code`; these labels are repository records, not a verified list of individual human contributors. Do not replace them or manipulate contributor statistics.

Keep dependency licenses and adapted implementation credits. [UI source credits](ui-attributions.md) record Aceternity UI and Hugeicons. No project LICENSE is declared; public repository access does not establish an open-source license. A license decision requires the rights holder's explicit instruction.

## Product branding

[DESIGN.md](../DESIGN.md) governs the editorial sage, forest, teal, and terracotta direction. `/design-system` is the live reference. The custom K-shaped mark remains the product mark; the favicon uses the same geometry.

- Application mark: `apps/web/src/components/WorkspaceIcon.tsx` (`KiroMark`)
- Transparent SVG: `apps/web/public/brand/kiro-mark.svg`
- Documentation wordmark: `apps/web/public/brand/kiro-wordmark.svg`
- Browser icon: `apps/web/src/app/icon.svg`

Do not stretch the mark, substitute a third-party logo, or replace the product name with the maintainer name. SVG export colors match the light tokens; in-app marks use `currentColor` for both reference themes. The wordmark's paper background is intentional and uses Georgia as a portable serif fallback.

The existing cover photograph remains in the application. Its provenance and usage rights are unverified; verify these before publication. The README now uses the repository's custom wordmark instead of this photograph. No product canonical URL or trademark-registration claim is invented.

## Future commits and releases

Use a Git identity genuinely associated with the authenticated contributor. The audit verified that the GitHub account is `codealisha99`, but the token cannot read account email settings. Therefore the existing local Git identity was preserved; no noreply email was guessed. Public contact email is not proof of a verified commit email.

Future release notes should describe actual changes and validation, retain contributor credit, and use the canonical maintainer contact. There is no changelog or release-author manifest to correct in this repository.
