@AGENTS.md

# XMS frontend (`xms-web`)

The Next.js and React application for XMS (Xelerated Managed Services): the internal desk at `xms.<domain>` (route group `app/(internal)`) and the client portal at `portal.<domain>` (route group `app/(portal)`). The specification set lives in the sibling `xms` spec repository (`01-architecture/USER-EXPERIENCE.md`, `DESIGN-SYSTEM.md`, `WIREFRAMES.md`, and section 6 of every `02-modules/*/TECHNICAL-SPEC.md`); this repository holds only the application.

## Rules that override defaults here

- **Security first (ADR-16).** Load the `xms-security-first` skill before designing, coding or reviewing. No authorisation decisions in the browser; no secrets or server-only values in `NEXT_PUBLIC_*`; CSP enforced; telemetry carries identifiers and structured facts, never ticket, email or article text.
- **The wireframes are the UI source of truth (ADR-17, ADR-18).** Navy finder bar, pinned sidebar, content header bar with removable filter chips, Count-card dense lists with no row striping, the v3 state ramp, 3px type bars, account identity dots, IBM Plex Mono for keys and SLA values, violet for AI-origin content only. Skills: `xms-web-design-system`, `xms-web-data-table`, `xms-web-ui-component`.
- **Tokens live in `styles/tokens`.** `aiinnovation-tokens.css` is vendored and never edited; `house.css` holds the `--aix-*` aliases and `--state-*` signal trios; `xms-scope.css` holds the identity; `theme.css` is the Tailwind v4 bridge (there is no `tailwind.config.js`). No raw hex in components.
- **The server is the only author of truth.** SLA due times, breach latches, derived priority, burn-down and permissions arrive from the API; the browser renders and counts down.
- **Build fails on lint or type errors.** `scripts/check-next-config.mjs` rejects `ignoreBuildErrors` and `ignoreDuringBuilds`; the pipeline gate runs `pnpm check` before any image is built.
- Tests are **Vitest** (unit and component) and **Playwright** (golden paths in `e2e/`); every `*.test.ts(x)` is discovered, there is no allowlist.
- No em-dashes in copy; ServiceNow vocabulary where it aids adoption (CS keys, work notes, resolution codes).

## Commands

- `pnpm dev`, `pnpm build`, `pnpm start`
- `pnpm check` runs lint, type-check, the config check and unit tests (the pre-PR gate)
- `pnpm test`, `pnpm test:e2e`
- `pnpm generate:api-types` regenerates `src/api-types` from the backend's `openapi.json` (set `XMS_OPENAPI_PATH`)

## Layout (planned, per ADR-14)

```
app/(internal)/   the desk: My work, Queue, Ticket, Dispatch, Operations, Knowledge, Time, Accounts, Capacity, Reports, Admin
app/(portal)/     the client portal
components/       shadcn primitives plus the XMS composition components
lib/axel-client/  the SSE streaming client for the Axel adapter
redux/            RTK Query base API and per-module slices
styles/tokens/    the four token layers
e2e/              Playwright golden paths
```
