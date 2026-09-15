# Conventions

## Theming

`useColor` returns a colour from the active theme. The token names come from
`@/theme/colors` — `primary`, `secondary`, `background`, `foreground`, `muted`,
`border`, `destructive`, and the rest of the semantic set.

```tsx
import { useColor } from '@/hooks/useColor';

function Panel() {
  const background = useColor('card');
  const border = useColor('border');
  return <View style={{ backgroundColor: background, borderColor: border }} />;
}
```

Sizing tokens live in `@/theme/globals`:

```tsx
import { BORDER_RADIUS, CORNERS, FONT_SIZE, HEIGHT } from '@/theme/globals';
```

## Dark mode

`useColorScheme` reports the active scheme and `useModeToggle` switches it.
Components read the theme themselves, so a component tree does not need to thread
the scheme through props.

## Composition

Components are plain React Native components with a `style` prop. Compose them
rather than reaching for a variant that does not exist — and when a variant does
exist, it is enumerated in the component's `meta.variants`.

## Common mistakes

- Writing `<div>`, `<span>`, `<button>`, or any `className`. There is no DOM.
- Hardcoding colours instead of calling `useColor`.
- Importing from a relative path instead of `@/components/ui/…`. The alias is
  what the copied source itself uses.
- Assuming a prop exists. Run `npx bna-ui info <name> --json` first.
- Reaching for a web package (`framer-motion`, `@radix-ui/*`, `tailwindcss`).
  Animation here is `react-native-reanimated`.

## A complete example

```tsx
import { Button } from '@/components/ui/button';
import { View } from '@/components/ui/view';
import React from 'react';

export function ButtonVariants() {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Button variant='default' onPress={() => {}} style={{ flex: 1 }}>
          Default
        </Button>
        <Button variant='destructive' onPress={() => {}} style={{ flex: 2 }}>
          Destructive
        </Button>
      </View>
      <Button variant='success' onPress={() => {}}>
        Success
      </Button>
      <Button variant='outline' onPress={() => {}}>
        Outline
      </Button>
      <Button variant='secondary' onPress={() => {}}>
        Secondary
      </Button>
      <Button variant='ghost' onPress={() => {}}>
        Ghost
      </Button>
      <Button variant='link' onPress={() => {}}>
        Link
      </Button>
    </View>
  );
}
```
