# WhosOn

Festival schedule companion app. Offline-first, Capacitor for iOS/Android.

## Tech Stack
SvelteKit 2 + Svelte 5, Tailwind CSS 4, daisyUI 5, Capacitor 7, Dexie.js (IndexedDB), date-fns, TypeScript strict.

## Key Rules

**Svelte 5 only** — runes (`$state`, `$derived`, `$effect`, `$props`), no Svelte 4 patterns. Files using runes outside components MUST be `.svelte.ts`.

**daisyUI 5** — themes are `[data-theme="name"]` CSS blocks in `app.css`, not `@theme` tokens. No `-bordered` suffix on form classes (v4 artifact).

**`useLiveQuery` caveat** — the querier closure must NOT read Svelte reactive variables. Query broadly, filter in `$derived`. See `src/lib/db/live.svelte.ts`.

**Time** — use `getNow()` from `src/lib/debug/time.svelte.ts` instead of `new Date()` in UI, to support debug time travel.

**Capacitor** — adapter-static fallback is `200.html` (not `404.html`).

## Build
- `npm run dev` / `npm run build` / `npm run check`
- `npm run dev:cap` — Capacitor live reload
- This is a `jj` repo — do not use raw git commands

## Debug Mode
Tap "version 0.0.1" in Settings 5x. Provides demo festival seeder and time travel slider.
