# Kiro design system

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

The desktop desk has navigation, a flexible reading column, and a source ledger. At 1100px the ledger becomes a drawer; at 760px navigation becomes a drawer. Documentation and admin use a maximum width of 1120px. Grid children must use `minmax(0, 1fr)` or `min-width: 0` where content could overflow. Long data tables scroll within their panel.

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

Focus is visible with a 2px teal outline; the composer uses `:focus-within`. Motion is limited to 120–180ms color feedback. Respect `prefers-reduced-motion`. Keep interactive elements native and label icon-only controls. Do not use placeholders as the only field label. Put action errors next to the action and give loading states readable text.

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

On smaller screens, the ledger remains open when switching between Library and Evidence. Navigation and ledger drawers include visible close controls, a dismissible backdrop, Escape dismissal, contained keyboard focus, and focus restoration. Reading content and long document titles wrap within their panels. The cover photograph uses dedicated foreground tokens so its text stays readable in either preview theme.
