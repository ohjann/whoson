# Who's On

[![CI](https://github.com/ohjann/whoson/actions/workflows/build.yml/badge.svg)](https://github.com/ohjann/whoson/actions/workflows/build.yml)

[GitHub](https://github.com/ohjann/whoson) | [Radicle](https://app.radicle.xyz/nodes/iris.radicle.xyz/rad%3Azcjc2W2eaGyDSYi11s7QL4puqG4N)

A festival schedule app for iOS and Android. Import a lineup from Clashfinder, mark the acts you want to see, and it'll tell you when things clash and what's on now. Everything stays on your phone, no account needed.

<p align="center">
  <img src="docs/screenshots/now-playing.png" width="240" alt="Now playing view" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/schedule.png" width="240" alt="Schedule view" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/welcome.png" width="240" alt="Welcome screen" />
</p>

## What it does

- Imports schedules from Clashfinder
- Lets you highlight acts and warns you when they clash
- Shows what's playing now and what's up next
- Sends local push notifications before sets start
- Works offline, all data is on-device in IndexedDB

## Installation

### iOS (AltStore Classic)

WhosOn is sideloaded via [AltStore Classic](https://altstore.io), which needs AltServer running on your Mac or PC. AltStore PAL (the EU marketplace version) won't work because it requires Apple notarization.

1. Install [AltServer](https://altstore.io) on your Mac or PC, then install AltStore Classic on your iPhone or iPad (iOS 16+).
2. In AltStore, go to Browse > Sources.
3. Tap Add Source and paste:
   ```
   https://raw.githubusercontent.com/ohjann/whoson/main/altstore/source.json
   ```
4. WhosOn will appear. Tap Get to install.
5. You'll need to refresh the app in AltStore every 7 days (AltStore+ can do this automatically).

You can also build from Xcode directly, see [below](#building-from-source).

### Android (APK)

No Play Store needed. Just grab the APK.

1. On your Android device, go to Settings > Apps > Special app access > Install unknown apps and allow your browser or file manager.
2. Download the latest `WhosOn.apk` from the [releases page](https://github.com/ohjann/whoson/releases/latest).
3. Open the APK to install.
4. Play Protect might complain. Tap "Install anyway". The code is all here if you want to check it.

## Building from source

> `pnpm dev` runs a local web server for development. The browser isn't a release target; the app ships as native iOS/Android builds through Capacitor.

### Prerequisites

| Tool | Minimum version |
|------|----------------|
| Node.js | 20 |
| pnpm | 10 |
| Xcode | 16 (iOS builds) |
| Android Studio | Latest stable (Android builds) |
| CocoaPods | 1.15+ (iOS builds) |

### iOS

```bash
git clone https://github.com/ohjann/whoson.git
cd whoson
pnpm install
pnpm build
pnpm cap add ios          # first time only
pnpm generate:assets
pnpm cap sync ios
pnpm cap open ios
```

In Xcode, set your development team under Signing & Capabilities, then build and run.

### Android

```bash
pnpm install
pnpm build
pnpm cap add android      # first time only
pnpm generate:assets
pnpm cap sync android
pnpm cap open android
```

In Android Studio, wait for Gradle sync, then build and run.

### App icons and splash screens

Source images are in `resources/`:
- `resources/icon.png` (1024x1024)
- `resources/splash.png` (2732x2732)

Regenerate after adding native platforms:

```bash
pnpm generate:assets
```

This fills in `ios/App/App/Assets.xcassets` and `android/app/src/main/res/` with all the sizes each platform needs.

## Development

### Project structure

```
src/
  lib/
    db/          # Dexie.js database schema and migrations
    features/    # Feature modules (schedule, highlights, etc.)
    components/  # Shared UI components
    types/       # TypeScript types
    utils.ts     # Shared utilities (cn(), etc.)
  routes/        # SvelteKit pages and layouts
resources/       # Source icon and splash screen assets
altstore/        # AltStore distribution metadata
scripts/         # Build helper scripts
```

### Tech stack

- [SvelteKit](https://kit.svelte.dev) 2.x with Svelte 5 runes
- [Tailwind CSS](https://tailwindcss.com) 4 + [daisyUI](https://daisyui.com) 5
- [Dexie.js](https://dexie.org) for IndexedDB (all offline data)
- [Capacitor](https://capacitorjs.com) 7 for native iOS/Android

### Tests

```bash
pnpm test:run       # run once
pnpm test           # watch mode
pnpm check          # type check
```

Tests sit next to their source files as `*.test.ts`.

### Live reload on device

```bash
pnpm dev:cap        # needs iOS device on same LAN
```

Detects your local IP, updates the Capacitor config, syncs, and opens Xcode.

## Contributing

If you want to contribute, open an issue first for anything non-trivial so we can talk it through.

1. Fork the repo
2. Create a feature branch
3. Follow the patterns in `CLAUDE.md`
4. Make sure `pnpm check` and `pnpm test:run` both pass
5. Open a PR

### Code conventions

See `CLAUDE.md` for the full list. The short version:

- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`)
- All data lives in Dexie.js, no server
- TypeScript strict mode
- Features go under `src/lib/features/`

## License

MIT, see [LICENSE](LICENSE).
