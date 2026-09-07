# frontend (`xms-web`)

The Next.js and React application for XMS. It serves two hosts from one codebase: the internal desk at `xms.<domain>` (route group `app/(internal)`) and the client portal at `portal.<domain>` (route group `app/(portal)`). The rules, the built layout and the environment are in `CLAUDE.md`; the specification lives in the sibling spec repository (`01-architecture/USER-EXPERIENCE.md`, `DESIGN-SYSTEM.md`, `WIREFRAMES.md` and section 6 of every `02-modules/*/TECHNICAL-SPEC.md`).

## Run it locally

```
pnpm install
cp .env.example .env.local   # NEXT_PUBLIC_API_BASE_URL, NEXT_PUBLIC_AUTH_DEV_MODE=true for the token paste sign-in
pnpm dev                     # http://localhost:3000 (desk) and /portal (client portal)
```

Sign in with a development token from the backend (`pnpm dev:token --email admin@example.test` there) at `/dev/sign-in`, or with Clerk when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set.

Quality gates, all of which must be green before a push:

```
pnpm check      # eslint, tsc --noEmit, the next.config check (no ignored errors), Vitest
pnpm test:e2e   # Playwright golden paths against a running API with the seed (E2E_API_TOKEN)
```

## What is built (2026-09-07)

- The desk shell (finder bar, pinned sidebar, content header with filter chips, command palette, notifications) and the composition components in `components/xms`.
- Tickets: Queue with system views, chips, Count cards, cursor paging and export; new ticket with the priority preview; the record with transitions, close discipline, conversation, activity, time, links, resolution, email, attachments and the rails; dispatch; quarantine.
- Knowledge: Solutions list and record, section editor, visibility, history, feedback, generalization with the findings sheet.
- Time: My timesheet and the Time tab, with the optional start time on Log time and the after-hours badge (class, the contract's handling, the multiplier); contract card from the contract position.
- Reporting: Operations and Account dashboards with "View as client", the comp-time panel per person on the account dashboard, report packs, audit search, security and usage dashboards, exports.
- Admin: accounts (settings, intake aliases, AI section, calendars, contracts with the after-hours handling editor, connectors, configuration overrides per catalog with the effective source and version history, or "Nothing active" when nothing resolves), users, roles, groups, configuration (operator defaults, read only), holiday libraries, connectors (health, maps, runs, dead letters), migration console (batches with dry runs and who ran them by name, records and the source payload, log, reconciliation with explanations, named signers and explainers, and four-eyes sign-off with the server's blocker in words).
- Portal: search-first home, requests list, new request, request detail with the public thread, files and closure confirmation, dashboard strip; its own light chrome.
- AI: the `redux/aiApi.ts` slice, the SSE parser and the `useAxelTurn` hook. The Axel panel and the AI admin screens are held (foundation first).

## Conventions

- Tokens only (`styles/tokens`), no raw hex; the wireframes are the UI source of truth.
- No authorisation decisions in the browser: `lib/routes.ts` gates navigation on the permissions the API returned, and every screen fails closed.
- Telemetry carries identifiers and structured facts, never ticket, email or article text.
- No em-dashes in copy; "generalization" is spelled with a z.
