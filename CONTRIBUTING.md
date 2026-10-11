# Contributing to Kiro

Kiro is maintained by [Alisha Karma](https://alishakarma.com), GitHub [@codealisha99](https://github.com/codealisha99). Report reproducible issues in [the repository](https://github.com/codealisha99/kiro/issues). For maintainer contact: lishykarma99@gmail.com.

Read [DESIGN.md](DESIGN.md) before changing the interface. Use semantic tokens and shared primitives; update `/design-system` for shared control changes. Check mobile and desktop, and both reference themes.

Use pnpm 10.30.3. Before proposing a change, run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`. The verification workflow runs these checks with read-only permissions and no deployment step. These cover the Node workspace; the default Java API also requires Java 21 and Maven (`cd apps/api-java && mvn test`). Run the live integration script only against a disposable local database: it creates users and documents.

Keep changes focused, explain behavior and verification, and preserve tenant isolation and document ACL checks. Never include credentials, private documents, or production data in a report. Follow existing API contracts and avoid unneeded schema changes.

Historical authorship remains in Git. Package maintainer metadata does not imply sole authorship of all source code. Third-party UI references are recorded in [ui-attributions.md](docs/ui-attributions.md). No project license is currently declared; do not assume an open-source license.
