# Kiro design system

## Organization workspace — 2026-10-24

Company dashboards retain the existing editorial surfaces and shared controls. Show only granted dashboard views, label the calculated scope, and keep missing-data methodology beside metrics. Organization setup uses labeled forms and scrollable tables. Connected applications display actual sync state and explicit unconfigured states; a saved resource without credentials must never look connected. Page composition lives in `components/organization.css` and uses semantic tokens in both preview themes.

## Work planning and company explorer — 2026-10-25

Project planning, source mapping, and provider actions stay inside the selected project's detail view. Clearly label estimates, declared availability, and prorated commitments so they cannot be mistaken for observed utilization. A provider action shows the exact content and repository, the independent review, and a separate final execution confirmation. Show uncertain provider outcomes with the marker needed for manual lookup.

The organization explorer is a bounded, permission-filtered view over stored work and organization relationships. Keep the current scope and metric method beside the tables. Entity traversal uses labeled native controls and a readable relationship list; retain overflow-safe wrapping and semantic tokens in both themes.

## Product and direction

Kiro is an internal company knowledge desk. Teams ask questions, read answers, and inspect the authorized evidence beside them. The first impression should be **trustworthy and calm**, confirmed by the user on 2026-10-07.

The direction is editorial: sage paper surfaces, forest ink, restrained teal actions, and terracotta source markings. Give answers room to breathe. Keep citations close to the claims they support. Favor precise labels over decorative icons and avoid gradients or animation that compete with reading.

The working reference is `/design-system`. It renders the actual shared controls with example knowledge, evidence, and sign-in layouts. Its theme toggle is a local preview; the application currently uses the light theme.

## Source of truth

- `apps/web/src/styles/tokens.css`: semantic colors, font families, type scale, spacing, radii, motion, shadows, and dark overrides.
- `apps/web/src/styles/primitives.css`: shared controls, fields, alerts, cards, and accessibility helpers.
- `apps/web/src/components/ui/index.tsx`: typed React primitives. Import from `@/components/ui`.
- `apps/web/src/app/globals.css`: workspace, auth, and evidence composition. Legacy names such as `--paper` resolve to the semantic tokens.

Tokens are defined once. Use `var(--color-…)` and `var(--space-…)` in new styles. Page styles own composition; primitives own control behavior. The backend has no visual layer; any future UI should follow this same system.

## Typography

| Role | Family | Usage |
| --- | --- | --- |
| Editorial | IBM Plex Serif, Georgia fallback | Headlines, answers, source passages |
| Interface | Outfit, system sans fallback | Forms, navigation, actions |
| Metadata | IBM Plex Mono, monospace fallback | Provenance, compact labels, code |

Fonts load through the existing Google Fonts stylesheet in `layout.tsx`, with `display=swap` and preconnect. The product stays readable if font loading fails. Use tabular numerals for metrics.

Base size: 15px, line height 1.5. Type tokens are 0.75, 0.875, 1, 1.125, 1.5, and 2rem. Large display type scales from 2.5 to 4.5rem. Reading text uses 17px/1.55; source passages use 15px/1.6. Editorial headings use normal weight and slightly tight letter spacing.

## Color

| Role | Light | Dark | Purpose |
| --- | --- | --- | --- |
| Canvas | `#e3e7df` | `#14201e` | App backdrop |
| Surface | `#f2f4ee` | `#1c2b28` | Paper, rails |
| Panel | `#fafbf7` | `#22332f` | Panels |
| Raised | `#ffffff` | `#293d37` | Inputs, active surfaces |
| Text | `#172b29` | `#eef2e9` | Primary ink |
| Muted | `#596760` | `#b2c2b7` | Secondary text |
| Border | `#c4cdc2` | `#455b50` | Structure |
| Accent | `#0a5c63` | `#8accca` | Primary action, focus |
| Marker | `#ad4121` | `#f0a07c` | Citation and classification |
| Success | `#246444` | `#a3d3ae` | Ready, completed |
| Warning | `#805411` | `#edc580` | Pending or incomplete |
| Danger | `#a12f35` | `#f2a4a8` | Failed actions |

Pair status colors with text. Use the corresponding soft token for tinted backgrounds. On-accent and on-ink tokens define readable foregrounds. Dark mode changes surfaces and foregrounds together through `[data-theme="dark"]`; never invert the page with a filter.

## Spacing, layout, and shape

Base rhythm: 4px. Spacing steps: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px.

Controls use an 8px radius; cards use 12px; auth uses 20px; metadata can use pills. Standard buttons and fields are at least 42px tall; compact utility buttons are at least 32px. Use 16–24px within panels and 32–64px between major sections.

The desktop workspace has a quiet 232px navigation rail and a single reading canvas. The question screen centers a 680px composer; the Library is a separate view. Upload forms and source documents open in native dialogs. Below 760px, navigation becomes a drawer. Documentation and admin use a maximum width of 1120px. Grid children must use `minmax(0, 1fr)` or `min-width: 0` where content could overflow. Long data tables scroll within their panel.

## Components and interaction

- `Button`: primary teal, ink default, secondary border, danger; small or regular; native `disabled`. Defaults to `type="button"`; explicitly use `type="submit"` in forms.
- `Input`, `Textarea`, `Select`: native semantics, forwarded refs, shared surfaces and focus treatment.
- `Field`: visible label, generated ID, hint/error association, invalid state. Render the control through its child function and spread the provided attributes.
- `Badge`: neutral, info, success, warning, danger. Existing classification classes remain compatible.
- `Alert`: status messages; danger alerts use `role="alert"`.
- `Card`: consistent surface, border, radius, and padding.

Example:

```tsx
<Field label="Work email" hint="Use your company email.">
  {(field) => <Input {...field} type="email" autoComplete="email" />}
</Field>
<Button variant="primary" type="submit">Open the desk</Button>
```

Focus is visible with a 2px teal outline; the composer uses `:focus-within`. Motion uses 120–180ms color feedback and subtle user-triggered surface transitions. Respect `prefers-reduced-motion`. Keep interactive elements native and label icon-only controls. Do not use placeholders as the only field label. Put action errors next to the action and give loading states readable text.

## Decisions

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-10-07 | Trustworthy and calm | User-selected first impression |
| 2026-10-07 | Keep the existing three font families and editorial direction | Preserve the product identity while making its rules reusable |
| 2026-10-07 | Semantic CSS tokens and native React primitives | Fit the existing Next.js frontend without introducing a UI framework |
| 2026-10-07 | Light application, scoped dark preview | Review dark colors without changing user theme preferences |

The palette refinements, spacing scale, component API, and dark palette are the first implementation proposal. Refine them in the live reference as the frontend develops.

## Integration refinements

Shared control styles own fields, buttons, badges, alerts, and cards; workspace, evidence, and authentication composition stays in `globals.css`. Fields retain the same size inside and outside forms. Completed answers and indexing use success and warning tones; source markings retain terracotta. The question composer uses the primary teal action.

On smaller screens, navigation includes a visible close control, a dismissible backdrop, Escape dismissal, contained keyboard focus, and focus restoration. Native dialogs provide the same keyboard behavior for uploads and source reading. Reading content and long document titles wrap within their panels. The cover photograph uses dedicated foreground tokens so its text stays readable in either preview theme.

## Workspace simplification — 2026-10-08

The user requested a simpler, more premium workspace. Keep the existing palette and typography, and create hierarchy through fewer visible controls and generous space:

- Ask Kiro is the default screen, with one composer and three optional question starters.
- Library is a separate view with search and quiet document rows. Show restricted access labels when relevant; avoid repeated status badges.
- Add document opens a focused dialog with separate file and text modes. Source details also open on demand.
- Search preparation belongs in Library, without chunk counts or technical banners in the question screen.
- Conversation questions use editorial headings; citations are compact source links. Errors offer a clear next action.
- The shared `Dialog` primitive uses native modal semantics, Escape dismissal, a visible close button, and focus restoration. Its interactive reference is under Components in `/design-system`.

## Aceternity refinements

`FileUpload` provides a keyboard-accessible dropzone with a selected-file summary, removal, and 10 MB validation. `StatefulButton` exposes controlled loading and success feedback; success must reflect a completed operation. Dialogs use restrained 180ms enter/exit motion while retaining native focus behavior. All three respect reduced motion and semantic theme tokens. Interactive previews are in `/design-system`; upstream sources are recorded in `docs/ui-attributions.md`.

## Icon and account refinement — 2026-10-08

Use Hugeicons Free Stroke Rounded through `WorkspaceIcon`: 18–20px for controls, 1.6px stroke, currentColor. Icons accompany clear labels; icon-only controls require accessible names. Keep the custom Kiro mark. The sidebar account entry opens a focused profile dialog with actual identity and role data, an admin overview link when permitted, and sign out. No placeholder settings or unsupported editing controls.

## Marketing entry — 2026-10-11

The public `/` page introduces the knowledge desk through an interactive, explicitly illustrative answer and source passage. It extends the existing editorial type and semantic palette, with a document stack, a three-step workflow, access and evidence explanations, and native expandable questions. `/app` hosts the workspace; `/app?mode=register` opens registration. Keep marketing claims aligned with available features and preserve direct access to the desk.

## Knowledge desk refinement — 2026-10-11

The desk uses a framed reading canvas and a quiet sidebar. A new workspace starts with document setup; a populated workspace offers a left-aligned editorial welcome, one question composer, three explicit question starters, and recent documents. The library supports title/source search, access filters, and sorting by update date or title. Citations open a reader with the exact excerpt first and an expandable full document; highlight the entire matching passage, allowing for different line breaks. Keep drawer focus handling, native dialogs, and all access checks intact.

## Sign-in composition — 2026-10-11

Sign-in and registration use a split composition: an editorial brand panel with a contained cover photograph, and a dedicated form area. On mobile, the brand reduces to a compact header so the form stays primary. Composition lives in `components/auth-screen.css`; fields and buttons continue to use shared primitives. Password visibility is an explicit native control, switching modes clears stale errors and the password, and both sections provide a route back to the marketing page.

## Product audit refinements — 2026-10-11

Preserve the established editorial direction. Public navigation includes legitimate maintainer and repository links. Recovery screens use the same serif hierarchy, teal actions, and paper surface. The admin overview uses a readable access/retry panel and an honest empty failure state; service-metric failures remain visible.

`--reading-width` is 680px and `--page-gutter` scales from 20 to 48px. Dedicated `--color-on-danger` and `--color-on-marker` foregrounds keep danger actions and source chips readable in both themes. The reference shows actual light/dark HEX values, including danger. The application remains light; dark is a scoped design preview.

Document classifications are workspace scoped. Public does not mean publicly accessible on the internet; restricted documents use owner or explicit access grants. Upload guidance explains this without altering API classification values.

The original cover photograph remains unchanged; its source and rights have not been established by this audit. Verify them before publishing.

## Brand assets — 2026-10-12

Keep the established custom K-shaped mark and the Kiro product name. The browser icon now uses the exact proportions of `KiroMark`, rather than a separate interpretation. Reusable SVG assets live in `apps/web/public/brand`: a transparent mark and a paper-backed wordmark for repository documentation. The wordmark uses a Georgia fallback for portability; application typography continues to use IBM Plex Serif. The live reference shows the mark and wordmark in both preview themes.

Use teal or the current foreground color for the mark. Preserve its aspect ratio, leave at least one stroke-width of clear space, and pair decorative marks with visible product text. Creator attribution belongs in maintenance information and the public footer. See `docs/OWNERSHIP.md` for identity, provenance, and asset limitations.


## Evidence and library audit — 2026-10-12

Keep the existing direction. Conversation search is a labeled native search field in the sidebar. Restricted documents use “Restricted” when listed or read, since explicit grants can allow other people to read them. The upload selector still uses “Only you” to explain the default grant for a new restricted document.

The source reader lists real version metadata, warns when a citation used an older version, and offers removal only when the API confirms permission. Removal has a separate confirmation and an honest explanation of its effect on saved answers. Use shared buttons, alerts, and native details; all composition colors and spacing come from semantic tokens. DOCX and XLSX join the existing formats in the shared upload control and live component reference.


## Document revision workflow — 2026-10-12

Version-history actions open the actual full text of the selected version; citations open their cited version. Label earlier versions clearly and keep a route to the current document. Titles and access labels describe the current document, while content, filename, and save time describe the selected version.

Authorized document edits use a focused text form within the source dialog. Keep the original file in its historical version, preserve access, protect unsaved drafts, and offer the latest text beside a conflicting draft before explicitly continuing. Reuse Field, Input, Textarea, Alert, and StatefulButton with semantic spacing and surfaces. Pending writes disable modal dismissal through `Dialog.closeDisabled`; the reference includes a labeled simulation of this state.

## Home dashboard and goals — 2026-11-10

Home is the default view and opens with a greeting, the person's scope label, and compact scope numbers that state their calculation beside them. Goals follow the order company, department, team, personal; empty groups are hidden. Each goal row pairs its progress bar with an "expected by today" marker, the percentage as text, a health label (On track, At risk, Off track, Achieved, No data, Cancelled), the distance to target, and the due date. Goals the viewer owns are marked "Yours" and carry an accent edge. Overdue tasks use the danger token together with the word "Overdue". Goal dialogs and the new-goal form use labeled native fields, inline validation, and server messages beside the action. The goal progress row is shown in `/design-system`.

## App shell, density, and chart kit — 2026-11-10

Keep Kiro's palette, fonts, and token system. Borrow Linear and Notion structure only: a quiet sidebar, 1px hairlines, a compact top bar, keyboard-first navigation, and calm empty states. Build screens from the pieces below; do not re-create chrome.

### Shell layout

- `components/Workspace.tsx` owns data loading, conversations, documents, and routing. It composes `components/shell/*`.
- Views: `home`, `ask`, `library`, `goals`, `work`, `organization` (`components/shell/nav.ts`). The active view is in `?view=` and changes push history. `?integration=xero` still opens `organization`.
- Sidebar (232px desktop, collapsible to 56px icons, remembered in `localStorage` `kiro-sidebar`; a drawer below 760px): workspace menu (profile, theme, sign out), New question, Home / Ask Kiro / Library, **Work** (Projects & tasks, Goals), **Organization** (Company dashboards, which also holds the explorer and connected applications tabs), then recent conversations.
- Top bar (48px): breadcrumbs, and the search / ⌘K trigger. On mobile the navigation drawer opens from the menu button.
- Density tokens in `tokens.css`: `--density-row` 36px, `--density-row-compact` 32px, `--shell-sidebar`, `--shell-sidebar-collapsed`, `--shell-topbar`. Prefer compact rows for lists and tables; keep 16–24px inside panels.
- Page composition: wrap a screen in `.shell-page` (max width `--content-width`, gutter `--page-gutter`).

### Page primitives (`@/components/ui`)

```tsx
<PageHeader
  eyebrow="Planning"            // optional
  title="Goals"                 // rendered as h1 with id "page-title" by default
  subtitle="Targets for the company, teams, and people."
  meta={<><span>12 goals</span></>}
  actions={<Button variant="primary">New goal</Button>}
  tabs={<PageTabs items={[{ id: "all", label: "All" }]} value={tab} onChange={setTab} label="Goal views" />}
/>
<Section title="Health" description="Counts from the goals you can see." actions={...}>
  <Panel tone="raised">…</Panel>
</Section>
```

`PageTabs` is a `tablist` with arrow-key navigation. `Section` labels its region with its heading. `Panel` is a bordered surface; `tone="raised"` is one step lighter. Shell-level components live in `components/shell/`.

### Keyboard

| Keys | Action |
| --- | --- |
| ⌘K / Ctrl K | Command palette (search, jump, ask, create, theme, recent conversations) |
| `?` | Keyboard shortcuts dialog |
| `g h` / `g a` / `g l` / `g w` / `g g` / `g o` | Home / Ask / Library / Work / Goals / Organization |

Shortcuts never fire while typing in an input, textarea, select, or contenteditable element, while a modifier is held, or while a native dialog is open. `g` must be followed within 1.2 seconds.

Palette behavior: Combobox and listbox pattern. Arrows move, Enter runs, Escape closes and returns focus to the trigger. "Ask Kiro: <text>" appears last when there are other matches.

**New goal hook:** the palette and shortcuts call `setGoalCreateRequest` and navigate to goals. `GoalsPage` receives `createRequest` (a counter in `components/GoalsPage.tsx`). Open the create dialog in an effect whenever that value changes. Do not rely on mount order.

### Theme

Three choices in the workspace menu and the palette: light, dark, system. Stored in `localStorage` `kiro-theme`, defaulting to light (the established application theme). `app/layout.tsx` applies `data-theme` before first paint (`THEME_INIT_SCRIPT` in `lib/theme.ts`). Never style by inverting; define new colors as token pairs in both `:root` and `[data-theme="dark"]`.

### Chart kit (`@/components/charts`)

Methods follow the data-viz guidance: categorical colors fixed in order, one hue per ramp, status colors reserved for meaning, a visible legend for two or more series, and every chart with a "View as table" twin. Helpers live in `charts/scale.ts` (tested in `tests/chart-scale.test.mjs`).

| Component | Props | Use for |
| --- | --- | --- |
| `StatTile` | `label`, `value` (pre-formatted string), `delta?: { change, text, good?: "up"\|"down"\|"neither" }`, `trend?`, `note?` | One headline number with a change |
| `Sparkline` | `values: (number\|null)[]`, `label`, `width?`, `height?` | Inline trend in a row or tile |
| `LineChart` | `title`, `series: { id, label, points: { x: epochMs, y }[] }[]` (1–4), `target?: { label, value }`, `description?`, `height?`, `yFormat?`, `valueFormat?`, `xFormat?`, `loading?`, `emptyText?`, `footer?` | Trends over time. Arrow keys and hover inspect values |
| `BarChart` | `title`, `categories: string[]`, `series: { id, label, values: (number\|null)[] }[]` (1–4), `stacked?`, plus the same optional props | Comparisons by period, grouped or stacked |
| `HBarChart` | `title`, `items: { id, label, value, detail? }[]`, `valueFormat?` | Rankings such as teams or people |
| `StackedBar` | `title`, `segments: { id, label, value, tone? }[]` (`good`, `warning`, `danger`, `accent`, `neutral`) | One 100% distribution, such as goal health or task status. Legend shows counts and shares |
| `ProgressBar` | `value` (0–1 or null), `expected?` (0–1), `label`, `valueText?`, `tone?` | Progress with an "expected by today" marker |
| `ChartFrame` / `ChartDataTable` | `title`, `table`, `loading`, `empty`, `emptyText`, `footer`, `children` | Building new chart types with the same frame and table toggle |

Formatters: `formatCompact` (axes), `formatNumber`, `formatPercent` (ratio in, string out), `formatDelta` (true minus sign). Date axes use UTC via `formatDayShort` / `formatDayLong`, so server and client render identically.

Rules:
- Pass numbers, not formatted strings, except `StatTile.value`.
- Charts size to their container with `ResizeObserver`. Give a fixed `height` only to line and bar charts.
- Use the tokens only; never pass raw hex.
- Empty and loading states are built in. Pass `loading` or empty data rather than hiding the chart.
- Bar series are limited to four. Beyond that, fold into "Other" or facet.

Example:

```tsx
import { LineChart, StatTile, ProgressBar } from "@/components/charts";

<StatTile label="Completed" value={formatNumber(42)} delta={{ change: 4, text: "+4 vs last week", good: "up" }} trend={weekly} />
<LineChart title="Completed per day" series={[{ id: "done", label: "Completed", points }]} target={{ label: "Target", value: 6 }} />
<ProgressBar value={0.52} expected={0.72} label="Revenue goal" valueText="52% complete. Expected 72% by today." />
```

### Validated palette

Light surface `#fafbf7` (`--color-panel`); dark surface `#22332f` (`--color-panel`). Tokens: `--chart-1` … `--chart-8`, `--chart-seq-1` … `--chart-seq-5`.

| Slot | Light | Dark |
| --- | --- | --- |
| 1 | `#007198` | `#00a4c0` |
| 2 | `#c0571e` | `#db703b` |
| 3 | `#00986c` | `#009d82` |
| 4 | `#9f6800` | `#aa8722` |
| 5 | `#b84379` | `#d36a96` |
| 6 | `#296818` | `#58994a` |
| 7 | `#6b4cae` | `#8d73d1` |
| 8 | `#b02a2d` | `#d8625c` |

Sequential (ordinal ramp, low to high): light `#87b3bf #529fb1 #0e899f #00738d #005b75`; dark `#2b6d7c #1b8fa5 #18b1cd #4cd1ee #9fecff`.

Validator (`node /tmp/kiro-dataviz/scripts/validate_palette.js "<hex,...>" --mode light|dark --surface <hex>`), exit 0 in both modes:
- Light: L band pass; chroma floor pass; CVD worst adjacent ΔE 8.9 (deutan, `#00986c` vs `#c0571e`), tritan 7.0; normal-vision worst ΔE 17.9; every slot ≥3:1 against `#fafbf7`. ALL CHECKS PASS.
- Dark: L band pass (0.48–0.67); chroma pass; CVD worst adjacent ΔE 8.8 (`#58994a` vs `#d36a96`), tritan 7.8; normal-vision worst ΔE 16.3; every slot ≥3:1 against `#22332f`. ALL CHECKS PASS.
- Sequential ramps, `--ordinal`: light passes all four checks (light end 2.19:1 against the surface); dark passes all four (light end 2.26:1).

Status uses the existing semantic tokens `--color-success`, `--color-warning`, `--color-danger`, not categorical slots. Status never follows the series palette. Always pair status color with text (a legend or a label).

Because the palette was derived from Kiro's hues, the validator measured it. Do not change a slot without rerunning both modes and updating this section.

### Verification (2026-11-10)

`typecheck`, `lint`, `test` (36 tests, including the scale math, theme, shell routing, and palette ranking), and `build` pass. Visual checks: desktop and 390px mobile, light and dark, the open palette, the shortcut dialog, the workspace menu, the collapsed sidebar, and `/design-system` (shell and charts sections in both themes).

## Product story and motion — 2026-11-10

Direction unchanged: same palette, fonts and calm editorial tone (the user chose to evolve rather than replace it). The landing page now tells the whole product instead of document Q&A only.

### Landing page (`app/page.tsx`, `app/landing-story.css`)

Order: hero → problem → how it works → evidence → goals → trust → FAQ → closing. Each section has one job:

- **Hero.** Editorial headline ("Ask your company what's happening.") with the **scope lens** below it (`components/landing/ScopeLens.tsx`): one illustrative company seen as the CEO, a manager and an employee. Switching role dims the people outside that view and collapses the goals they can't see. The roles are a native radio group, so arrow keys work, and a polite live region states the result ("Riley sees 1 of 7 people and 4 of 6 goals").
- **Problem.** A before/after: the status scattered across a thread, a ticket, a pull request and a spreadsheet, beside one cited answer.
- **How it works.** Connect → scope → answer, joined by a line that draws as the section scrolls in. It lists only providers the API can connect today: Slack, Linear, GitHub, Google Drive, Google Analytics, HubSpot and Xero.
- **Evidence.** The existing interactive cited-answer demo (`LandingDemo`).
- **Goals.** `GoalAnatomy`: one worked metric goal showing progress, the expected-by-today marker, the gap, the health it produces, and the distance to target.
- **Trust.** Only claims the code enforces: permissions applied inside the query, restricted documents, the 24-hour freshness rule for connected tools, and "we don't know".

Every example is labeled illustrative. The lens data (`lib/scope-lens.ts`) uses the product's real visibility rules and health thresholds; `tests/scope-lens.test.mjs` fails if the copy drifts from them. Never add customers, testimonials, statistics or integrations that don't exist.

### Motion tokens (`styles/tokens.css`)

| Token | Value | Use |
| --- | --- | --- |
| `--duration-fast` | 120ms | Hover and press feedback |
| `--duration-normal` | 180ms | Control state changes, dialogs |
| `--duration-slow` | 260ms | Scope and panel changes, view entrances |
| `--duration-reveal` | 520ms | Content entering the page (landing hero) |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Controls |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrances and reveals |
| `--stagger` | 60ms | Delay between items entering together |

Rules:
- Motion explains a change (what entered, what left, what grew); it never delays an action.
- Below-the-fold reveals use native scroll-driven CSS (`animation-timeline: view()`) inside `@supports`, so unsupported browsers simply show the content. Don't hide content with JavaScript before it animates.
- Switching app views plays a 260ms entrance on the new view (`shell.css`, `shell-view-in`). It adds no wrapper element, so view layouts are untouched.
- `globals.css` turns off every animation and transition under `prefers-reduced-motion`.

### Lessons from this review

- Don't style bare elements (`kbd`, `p`) from a page stylesheet. Two such rules leaked: `goals-page.css` faded every `<kbd>` in the app below AA contrast, and `.work-screen p` greyed out the chart kit's stat values. Scope to a class.
- `GoalRow` renders its own `<li>`. Put it directly inside a `<ul>`; wrapping it in another `<li>` breaks hydration.
- Hide visible text with the `sr-only` pattern, not `display: none`, when it is the control's accessible name (the mobile search button).

Verified: typecheck, lint, 72 web tests, the production build, zero serious axe violations on the landing page and on every app route at 1440px and 390px in both themes, no horizontal overflow, and no React warnings in development on any route.

## Company readiness: setup, graphs and administration — 2026-11-10

### First run (`HomeSetup`, `lib/setup-checklist.ts`)

Whoever can manage the organization (`/organization` `canManage`) sees a six-step guide at the top of Home until every step is done: add knowledge, connect a tool (a `READY` connection), add teams, invite people, set reporting lines and roles (both required), and set a goal. Each step is checked against real records, never a local "done" flag. The demo viewer created by the sample documents (`viewer@<slug>.demo`) is not counted as an invited colleague. Each step's button opens the place where that work happens; `?tab=` opens an Organization tab, falling back to Overview when the tab isn't visible. "Hide for now" is remembered (`localStorage` `kiro-setup-hidden`), and a one-line summary leads back to the guide.

The workspace menu shows the company's name: `/auth/me`, login and register return `tenantName` on the signed-in user's own record.

### Graphs by screen

| Screen | Graph | Question it answers |
| --- | --- | --- |
| Goals | Goal health (`StackedBar`) | How healthy are we? |
| Goals | Furthest behind today's pace (`HBarChart`, points) | Which goals are slipping? |
| Goals | Progress against plan, by level (`BarChart`) | Which level of the company is behind? |
| Projects | Task status (`StackedBar`: done, open, blocked) | Where does the work stand? |
| Projects | Completed per week | Are we delivering? |
| Projects | Projects by completion (`HBarChart`) | Which projects are nearly done, which lag? |
| Library | How current is it? (30 days, 6 months, older) | Is our guidance still current? |
| Admin | Questions per day, answered and failed | Are people using it, and is it working? |
| Admin | Answer feedback, search preparation | Are answers good, and is knowledge ready? |

Helpers are pure and tested: `behindPace` and `progressByScope` (`goal-view.ts`), `taskStatusSegments` and `projectCompletion` (`work-metrics.ts`), `freshnessSegments` (`library-model.ts`), and `questionsPerDay`, `feedbackSegments`, `searchReadiness` and `decisionLabel` (`admin-view.ts`). Category labels stay short; put counts in the description so axis labels never collide.

### Admin console (`/admin`)

Sections: Usage, Activity, Document processing, Audit log (the 50 most recent events, with person names and readable access decisions), Service performance, Answer quality. Each secondary panel loads and fails on its own, with its own message. Wide tables are focusable, labeled scroll regions.

`/admin/ingestion` is tenant-scoped. The job queue is shared by every workspace, so it never returns queue lengths or raw dead-letter entries; failures are returned only when their document version belongs to the caller's workspace (`AdminIngestionTest`).

### Fixes to shared pieces

- `useChartWidth` uses a callback ref. A chart that mounts in its loading state now measures itself once its body appears; before, it stayed at the 640px fallback and overflowed its panel.
- `niceDomain` never invents negative values for flat non-negative data, so all-zero counts get a 0–1 axis, not −1 to 1.
- `shell-view-in` is defined once, in `primitives.css`.
- The `/design-system` shell sample drops its sidebar below 760px, as the app does.

Verified: 171 Java tests, 84 web tests, typecheck, lint, the production build; zero serious axe violations, no horizontal overflow and no console errors on 12 screens × 2 widths × 2 themes; no React warnings in development; setup links, hide/show and step completion checked in the browser against a fresh workspace.
