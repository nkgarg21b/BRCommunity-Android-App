# BRCommunity Android Helper

An Android companion that signs into BRCommunity and manages discovery links in controlled, timed browser cards.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/brcommunity-android-helper run dev` — run the Expo Android/web preview
- `pnpm --filter @workspace/brcommunity-android-helper run typecheck` — typecheck the mobile app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/brcommunity-android-helper/app/index.tsx` — sign-in and control-center screen
- `artifacts/brcommunity-android-helper/context/ManagerContext.tsx` — persisted manager state, queue, timers, heartbeats, and activity
- `artifacts/brcommunity-android-helper/components/BrowserCard.tsx` — managed mobile browser surface with WebView playback and engagement injection
- `artifacts/brcommunity-android-helper/lib/brcommunity.ts` — BRCommunity API contract, secure credentials, config normalization, and injected browser behavior
- `artifacts/brcommunity-android-helper/constants/colors.ts` — mobile design tokens

## Architecture decisions

- The BRCommunity API remains the source of truth for configuration, discovery, session heartbeats, and emergency stop state.
- Tokens use SecureStore on native platforms and AsyncStorage only for the web preview fallback.
- Desktop Chrome windows map to managed in-app browser cards on Android; this preserves playback, timing, engagement, layout, and telemetry without requiring control over another app.
- Timers and session state are persisted so a resumed app can recover its managed session instead of silently resetting it.

## Product

The app signs in with the existing BRCommunity extension account, lets the user choose Reels, Shorts, Videos, or Channels plus Community or My links mode, loads live server settings, and runs a controlled browser session. It opens links on the configured cadence, auto-plays media, attempts Like + Subscribe/Follow before close, cycles the active surface, closes cards after randomized server-defined durations, reports discovery clicks and heartbeats, and shows health/activity history.

## User preferences

No standing preferences recorded.

## Gotchas

- Android apps cannot silently resize, close, or inject JavaScript into the separate Chrome app under the normal app sandbox. The controlled WebView surface is intentional; opening a link in Chrome is a web-preview fallback, not a managed session.
- The app uses the extension endpoints at `https://brcommunity.xyz/community/api` by default. A different BRCommunity installation can override the base through Expo public environment variables.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
