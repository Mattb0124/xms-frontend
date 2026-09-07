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
- Time: My timesheet and the Time tab, with the optional start time on Log time, the after-hours badge (class, the contract's handling, the multiplier), the amount and the frozen rate per entry, the Over budget pill and the overage_blocked refusal in words; contract card from the contract position.
- Budget: the account record's Budget tab and the account dashboard's Budget tab (`/accounts/[id]?tab=budget`, the target of the threshold notifications, reachable with tickets:view alone) with one card per active contract: consumed against available, the burn bar that turns amber at the first fired threshold and red once over, threshold ticks with the fired ones marked and the next named, the forecast sentence, the unrated note, and the drill-through of entries by person, activity and billable class over the period (Export waits for an export route).
- Billing periods: the account record's Billing tab with one period per calendar month, its state (Open, Submitted, Approved, Locked, Exported), the summary the server kept (hours, amount, by class, unrated hours) and the checksum prefix; New period from a month picker (time:lock-period); Submit and Reopen (contracts:manage), Approve and Lock (time:lock-period) with invalid_transition and stale_version in words; CSV and Excel finance files for a locked period fetched with the session token, and the export records with rows, checksum and delivery state.
- Capacity: the Capacity view (`/capacity`) with the month, role, group and account in the URL, one row per person with available, allocated, actual and remaining hours and the status pill (Available, Near capacity, Over, No calendar), totals, and the allocation cells per account editable inline under capacity:manage and saved as one PUT with versions (stale_version reloads); Planned versus actual (`/capacity/variance`) by month, account and person with the variance in hours and percent, largest first (Export waits for a route); PTO on the person record for the person themselves or a capacity manager; the assignee picker shows each roster candidate's remaining hours this month with a warning marker when near or over capacity.
- Reporting: Operations and Account dashboards with "View as client", the comp-time panel per person on the account dashboard, report packs, audit search, security and usage dashboards, exports.
- Admin: accounts (settings, intake aliases, AI section, calendars, contracts with the rules editor (after-hours handling, overage, rollover, thresholds, client notification, forecast window) and rate card versions per contract and as the account default, billing periods, connectors, configuration overrides per catalog with the effective source and version history, or "Nothing active" when nothing resolves), users, roles, groups, configuration (operator defaults, read only), holiday libraries, connectors (health, maps, runs, dead letters), migration console (batches with dry runs and who ran them by name, records and the source payload, log, reconciliation with explanations, named signers and explainers, and four-eyes sign-off with the server's blocker in words).
- Portal: search-first home, requests list, new request, request detail with the public thread, files and closure confirmation, dashboard strip; its own light chrome.
- AI: the `redux/aiApi.ts` slice, the SSE parser and the `useAxelTurn` hook. The Axel panel and the AI admin screens are held (foundation first).

## Conventions

- Tokens only (`styles/tokens`), no raw hex; the wireframes are the UI source of truth.
- No authorisation decisions in the browser: `lib/routes.ts` gates navigation on the permissions the API returned, and every screen fails closed.
- Telemetry carries identifiers and structured facts, never ticket, email or article text.
- No em-dashes in copy; "generalization" is spelled with a z.
