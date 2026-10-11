# Kiro route inventory

Recorded before implementation on 2026-10-11. Baseline working tree: clean, branch `main`, HEAD `53eecc5`. Product direction: preserve the established editorial knowledge desk.

| Route / state | Purpose | Existing composition | Improvement scope | Initial status |
| --- | --- | --- | --- | --- |
| `/` | Product introduction | Marketing header, illustrative answer, workflow, FAQ, footer | Navigation at small widths, accurate access copy, creator links | Source inspected |
| `/app` signed out | Sign in | Editorial split layout, native fields | Helpful network errors, password validation, busy semantics | Source inspected |
| `/app?mode=register` | Workspace registration | Same auth layout with workspace/name fields | Clear setup guidance, trim input, preserve real API | Source inspected |
| `/app` signed in | Ask, history, library, uploads, reader, account | Sidebar, reading canvas, native dialogs | Session recovery, library dialog trigger, access labels, keyboard reading | Source inspected; live backend unavailable |
| `/admin` | Workspace metrics and evaluations | Metric cards, table, raw failure details | Retry, role-specific errors, service status, empty states | Source inspected; live backend unavailable |
| `/design-system` | Live component reference | Foundations, typography, controls, contextual previews | Accurate dark HEX values, semantic foregrounds, recovery-state reference | Source inspected |
| Unknown path | 404 | Framework default | Branded navigation recovery | Source inspected |

API endpoints are not user-facing routes. No billing, password reset, standalone settings, legal, or documentation routes exist. Account and library are states inside `/app`.

Baseline browser discovery found port 3000 serving an unrelated application (slacki); this is not Kiro evidence. Use dedicated port 3010 for this repository. T3 preview reported no automation host; local browse is the fallback.

Implementation completed across the discovered compositions. Verification evidence and remaining authentication/service limits are recorded in [product-audit.md](product-audit.md) and [browser-check.json](browser-check.json). A source review is not a substitute for a signed-in browser check.
