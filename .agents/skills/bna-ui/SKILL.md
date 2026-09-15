---
name: bna-ui
description: >-
  Build React Native and Expo interfaces with BNA UI — 52
  components, 18 charts, hooks and a theme system, installed as
  source with `npx bna-ui add`. Use when working in a React Native or Expo
  project that has BNA UI, when adding UI to one, or when the user mentions
  bna-ui, @/components/ui, or useColor. Not for web React.
---

# BNA UI

A component library for **React Native and Expo**, distributed as source code.

## The one thing to get right

This is **not a web library**. Components render through `react-native`, not the
DOM. Before writing any JSX here:

- No HTML elements and no `className`. Use `View`, `Text`, `Pressable`, and the
  components listed in `references/catalogue.md`.
- Style with `StyleSheet` objects and the `style` prop.
- No Tailwind, no Radix.

Every other component library in your training data is for the web. This one is
not, and defaulting to `<div className="flex">` is the failure mode to watch for.

## Adding a component

```bash
npx bna-ui add button
```

Copies the component's source into the project along with everything it imports,
and prints the npm packages to install. The project owns the code afterwards —
edit it freely.

Scaffold a new app with `npx bna-ui init my-app`, or add a backend with auth:
`npx bna-ui convex|supabase|firebase my-app`. Add `--no-auth` for the
backend without sign-in.

## Imports and theming

Component source resolves its dependencies through these aliases. They are part
of the contract:

```
@/components/ui/*      components
@/components/charts/*  charts
@/hooks/*              hooks
@/theme/*              colours and sizing tokens
```

Colours come from the `useColor` hook, which reads the active light/dark theme —
**never hardcode a hex value**. Sizing tokens (`HEIGHT`, `FONT_SIZE`,
`BORDER_RADIUS`, `CORNERS`) come from `@/theme/globals`.

```tsx
import { Button } from '@/components/ui/button';
import { useColor } from '@/hooks/useColor';

const primary = useColor('primary');
```

## Finding the API of a component

Do not guess props. Get them:

```bash
npx bna-ui info button --json
```

Returns the description, props, variants, usage snippet, accessibility notes,
dependencies, full source and every example. The same data is at
`https://ui.ahmedbna.com/r/ai/<name>.json`, and any documentation page is available as Markdown
by appending `.md` to its URL.

## References

- `references/catalogue.md` — every component, chart, hook and theme file with
  its description. Read this to find the right component.
- `references/conventions.md` — theming, layout, platform notes and the mistakes
  that come up most.
- `references/endpoints.md` — the machine-readable endpoints and the MCP server.
