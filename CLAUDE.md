# WhosOn - Project Conventions

## Tech Stack
- SvelteKit 2.x with Svelte 5 (referred to as "SvelteKit 5" in stories)
- Tailwind CSS 4 via @tailwindcss/vite (no tailwind.config.js or postcss.config.js)
- daisyUI 5 for component themes (configured via CSS `@plugin` syntax in app.css)
- bits-ui for headless UI primitives
- Capacitor 7 for iOS + Android
- Dexie.js for IndexedDB (all client-side data)
- date-fns + @date-fns/tz for date/time handling
- TypeScript strict mode

## Svelte 5 Rules — MANDATORY
- Use ONLY Svelte 5 runes: $state, $derived, $effect, $props, $bindable
- Utility files that use runes MUST use `.svelte.ts` extension (not plain `.ts`) — otherwise runes are not compiled and `$state is not defined` at runtime
- NO Svelte 4 patterns: no `export let`, no `$:` reactive statements, no `<slot />`
- Use `{@render children()}` instead of `<slot />`
- Use `let { prop1, prop2 } = $props()` instead of `export let`
- Use `$state()` instead of `let x = value` for reactive state
- Use `$derived()` instead of `$: x = ...` for computed values
- Use `$effect()` instead of `$: { ... }` for side effects

## Architecture
- Feature-based organization: `src/lib/features/{feature}/`
- Shared components: `src/lib/components/ui/`
- Database: `src/lib/db/`
- Types: `src/lib/types/`
- Utilities: `src/lib/utils.ts`

## Data Layer
- ALL data stored in Dexie.js (IndexedDB)
- No server-side data fetching (app is fully offline-first)
- Dexie liveQuery for reactive data:

```typescript
// Bridge pattern: Dexie liveQuery Observable → Svelte 5 $state
// Use the useLiveQuery() utility from src/lib/db/live.svelte.ts
// IMPORTANT: Must use .svelte.ts extension so Svelte compiler transforms $state/$effect runes
// It subscribes to a liveQuery Observable in $effect,
// writes results to a $state variable, and cleans up on destroy.
function useLiveQuery<T>(querier: () => Promise<T>, initialValue: T) {
  let result = $state(initialValue);
  $effect(() => {
    const subscription = liveQuery(querier).subscribe({
      next: (value) => { result = value; },
      error: (err) => console.error(err)
    });
    return () => subscription.unsubscribe();
  });
  return { get value() { return result; } };
}
```

## Date/Time Handling
- Use date-fns for all date operations
- Use @date-fns/tz TZDate for timezone-aware display
- Festival times stored as ISO 8601 strings (festival-local time)
- Display uses festival.timezone (IANA string), NOT device local timezone
- Day boundary at festival.dayBoundaryHour (default 6 AM)

## Testing
- Vitest with colocated test files: `*.test.ts` next to source
- fake-indexeddb for Dexie tests
- @testing-library/svelte for component tests

## Styling
- Tailwind 4 utility classes preferred
- Use cn() from src/lib/utils.ts for conditional classes
- daisyUI semantic classes for themed components
- bits-ui for accessible headless primitives

## Build
- `npm run dev` — Development server
- `npm run build` — Static build to /build
- `npm run check` — TypeScript checking
- `npm run dev:cap` — Capacitor dev with live reload (syncs LAN IP, opens iOS)
- `npm run build:cap` — Build + sync to native platforms

## Capacitor Notes
- adapter-static fallback is '200.html' (NOT '404.html') for Capacitor SPA mode
- capacitor.config.ts is TypeScript (not JSON)
- scripts/syncnetworkconfig.js detects LAN IP for live reload on device
- iOS and Android platforms are gitignored but must be initialized with `npx cap add`

## Key File Locations
- App CSS + theme config: `src/app.css`
- Vite config (Tailwind plugin): `vite.config.ts`
- SvelteKit config (adapter): `svelte.config.js`
- Capacitor config: `capacitor.config.ts`
- DB schema: `src/lib/db/index.ts`
- cn() utility: `src/lib/utils.ts`
