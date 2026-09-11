# Effi design system

Source of truth for the officer dashboard and the citizen claim page. Derived from `DESIGN.reference.md` (Supahub). Where the raw reference and this file disagree, this file wins for product UI. Tokens live in `packages/design-tokens/src/web.css`; shared web primitives live in `packages/ui-web`.

## Atmosphere

Soft daylight on a violet ridge. Mostly white surfaces lit by one vivid violet, with gradient orbs spilling color behind product surfaces and generous rounded geometry everywhere. The claim page reads calm and conclusive. The dashboard keeps the same quiet canvas at a higher density because officers scan lists, not landing pages.

- Theme: light only. No dark mode.
- Density: 4/10 on the claim page, 6/10 in the case inbox.
- Motion: subtle entrance and state feedback. No cinematic choreography and no perpetual motion on data.

## Color

| Token | Value | Role |
|---|---|---|
| `--effi-canvas` | `#ffffff` | Page background |
| `--effi-surface` | `#ffffff` | Cards, list, panels |
| `--effi-fog` | `#f1f5f9` | Secondary surface, hover rows, skeletons |
| `--effi-lavender-field` | `#ebdafd` | Highlight panels, claim context, open stat tile |
| `--effi-lavender-mist` | `#ad6df4` | Decorative violet, gradient mid-stop |
| `--effi-orchid-wash` | `#bd8ff0` | Light decorative wash |
| `--effi-mint-wash` | `#d6fcf4` | Success tone, resolved stat tile and resolved badge |
| `--effi-ink` | `#111827` | Text, dark filled controls, critical badge |
| `--effi-graphite` | `#3f4654` | Secondary text |
| `--effi-muted` | `#6b7589` | Metadata, helper copy, icons |
| `--effi-border` | `#d8e0ea` | Hairline borders and dividers |
| `--effi-action` | `#862fe7` | Primary action, active accent, brand |
| `--effi-action-hover` | `#5f259e` | Action hover and violet text on lavender |
| `--effi-danger` | `#d92d20` | Errors only |
| `--effi-danger-soft` | `#fef3f2` | Error panel background |

Pink (`#ff5fe4`, `#e22ba4`) and amber (`#dc5f05`) exist only inside gradient orbs. Never use them for text, borders, or states.

## Typography

Two faces, never mixed at the same size.

- **Bricolage Grotesque** (`--font-display`), weights 400 and 600, for headings and stat numbers at 20px and above. Tracking is -0.025em at 24px and tighter as size grows. Never set it below 20px.
- **Inter** (`--font-ui`), weights 400 to 700, for every other surface: nav, buttons, list rows, metadata, form text. Uppercase labels at 12px use +0.1em tracking.

| Role | Size | Line height | Face |
|---|---|---|---|
| Caption and eyebrow | 12px | 1.5 | Inter 700, uppercase, +0.1em |
| Body small | 14px | 1.6 | Inter 400 |
| Body | 16px | 1.6 | Inter 400 |
| List title | 16px | 1.4 | Inter 600 |
| Subheading | 20px | 1.4 | Inter 600 |
| Section heading | 24px | 1.25 | Bricolage 600 |
| Page heading | 32 to 44px | 1.1 | Bricolage 600 |
| Stat value | 36px | 1 | Bricolage 600 |
| Display | 48 to 56px | 1 | Bricolage 600 |

## Shape and depth

- Buttons, chips, and inputs: 12px radius.
- Cards, panels, list containers, claim frame: 24px.
- Avatars, tags, badges, status pills: 9999px.
- Images: 16px.
- Filled buttons carry a 1px inset ring, `rgba(11, 61, 121, 0.16) 0 0 0 1px inset`.
- Floating surfaces (claim frame) get one soft violet shadow, `0 20px 40px rgba(124, 58, 237, 0.12)`. No other drop shadows. Depth comes from borders and surface tone.

## Components

- **Primary button.** Violet fill, white text, 12px radius, Inter 600. Dark fill on lavender panels.
- **Dark button.** Ink fill, white text. Used for neutral strong actions such as clearing filters.
- **Ghost button.** Transparent, 1px ink border, ink text. Hover fills with fog.
- **Badge.** Pill. Tones map to meaning: violet for new, ink for critical, lavender for high and assigned, orchid for under inspection, fog for in progress and medium, mint for resolved, outline for low.
- **Filter chip.** Pill with 1px border. Active state is ink fill with white text. "All" chip clears its group.
- **Stat tile.** Surface with an uppercase Inter 12px label and a Bricolage 36px value. Open uses lavender field, resolved uses mint wash, the rest stay white.
- **List row.** White row inside a 24px-radius container, divided by fog lines. Priority badge left, summary, then metadata (category, report number, channel). Status badge and relative time right. Hover fills with fog.
- **Skeleton.** Fog block with a translating highlight, matching the exact dimensions of the content it replaces. No circular spinners except the claim page progress mark.
- **Empty and error states.** Surface with an eyebrow, Bricolage heading, short message, and an optional action. Errors switch to the danger surface.

## Gradient orbs

One or two orbs per view, always behind surfaces, never behind text or buttons. Orbs are radial gradients from a violet or pink tint to transparent, capped near 0.35 opacity. The dashboard places one violet orb behind the stat row. Empty states may place one small pink orb in a corner.

## Layout

- Page max width 1200px, centered, 24px side padding.
- Sticky white top bar with a 1px border. Brand left, account control right.
- Dashboard order: header, stat row (4 up), filter row, case list. Section gaps are 32px.
- The claim page uses a two-column frame on wide screens: lavender context panel left, white action panel right.
- Below 840px every multi-column layout collapses to one column. Stats go 2 up, then 1 up below 560px.

## Copy

Sentence case. Direct, calm language. No exclamation marks, no em dashes, no emoji, no filler. Buttons name the action. States explain what happened and what to do next.

## Anti-patterns

- No dark mode, no second accent, no pinks or ambers outside orbs.
- No Bricolage below 20px and no Inter above subheading sizes.
- No sharp corners on primary surfaces and no heavy drop shadows.
- No glassmorphism, neon glows, gradient text, or overlapping content.
- No hardcoded demo data. Every value on screen comes from Convex.
- No centered hero copy longer than 720px.
