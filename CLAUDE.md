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

## Layout (as built 2026-09-07, per ADR-14)

```
app/layout.tsx          fonts, .xms-scope, Providers
app/(internal)/         the desk inside the Shell: / My work (scorecards, brief line, needs attention, my open tickets),
                        /tickets Queue (system views, chips, Count card, selection bar, cursor paging), /tickets/new (record form
                        with the priority preview), /tickets/[key] (record bar, transition menu, properties, Conversation,
                        Activity, Time, Links, Resolution, Email, rail with Service levels, Attachments, Solutions, Contract, Requester,
                        Watching), /tickets/dispatch (cards per account) (P1.5.5, P2.12.4 basics), /tickets/quarantine
                        (held email: reason, stripped body, decide with confirm on the destructive ones; P1.6.5);
                        /knowledge Solutions list (chips, search, New article), /knowledge/new, /knowledge/[key] (record bar,
                        section editor, Visibility, History, Feedback, Submit, Publish, Retire, Generalize with the findings
                        sheet) (P2.15.1, P2.15.2); /time My timesheet (week picker, day groups, quick Log time) (P2.12.x);
                        /operations (P2.19.3: period switcher, synthesis line, six tiles, SLA meters, outcomes, backlog by age,
                        open by priority and type, notable tickets, per-account strip; needs reports:view-portfolio),
                        /accounts (granted accounts with open counts from the strip when permitted), /accounts/[id] (one account:
                        the same panels, "View as client" re-fetches as_client=true and shows only what came back, Reports card
                        with runs and "Generate weekly report"), /reports/packs/[id] (frozen numbers, narrative, PPTX link),
                        /admin/audit (P2.11.5: condition builder over the three streams, results, record drawer with old and new
                        values, "Show this request" pivot, Load more, Export CSV with audit:export), /admin/security and
                        /admin/usage (P2.19.4 tiles and count lists); the Queue has an Export menu (Excel, CSV) over the current
                        view and chips (P2.11.4),
                        /admin overview and the built admin screens (P1.4.3, P1.4.4): /admin/accounts(+/[id]),
                        /admin/users(+/[id]), /admin/roles(+/[id]), /admin/groups(+/[id]), /admin/config (read only); the
                        account record has an Intake tab (inbound aliases, enable and disable, add) (P1.6.5) and a Connectors
                        tab (instances, Add ServiceNow instance with the credential shown once) (P2.21.4);
                        /admin/connectors (health overview across granted accounts, admin:connectors) and /admin/connectors/[id]
                        (header with mode switch, kill switch, Test connection; tabs Settings with the watermark rewind, Field map,
                        State map, Runs, Dead letters with replay and discard) (P2.21.4, SN-07 to SN-09),
                        /dev/tokens (token check), /dev/sign-in (dev-mode token paste only)
components/tickets/     ticket-columns (the Queue column set), transition-menu (state pill menu, pause, resolve, confirm sheets),
                        resolve-form (close discipline mirror over the catalog codes), solution-picker (search over published
                        articles), solutions-rail (matching articles with Use this, similar tickets, resolution records, propose
                        an article), time-tab (entries with adjustments, LogTimeForm), contract-card (burn from the position),
                        resolution-tab, conversation-tab (Composer with Reply / Work note), activity-tab, links-tab,
                        properties-panel, sla-rail (meters with countdown, requester, watch from the record), assignee-picker,
                        attachments (DropZone, useUploads, UploadList, ScanAcknowledgement, AttachmentRow, AttachmentsCard; the
                        composer blocks Send while a scan is pending; P1.6.2), email-panel (inbound with matched_by and
                        disposition copy, loop signals, View raw; outbound with delivery state)
components/reporting/   format (percent, hours, period, age buckets, periods), period-switcher, measure-panels (TileStrip, SlaPanel,
                        OutcomesPanel, BacklogPanel, BreakdownPanel, NotablePanel, ConsumptionPanel, synthesisLine; each renders
                        only when its measure is present so the client view reuses them), operations-dashboard, account-dashboard,
                        accounts-list, reports-card (runs, RunStatusPill, generate), report-pack
lib/exports/            fetchDownload (bearer fetch to a blob, filename from Content-Disposition, x-row-count), saveBlob (object
                        URL and a temporary anchor), downloadFile; presigned pack URLs never come through here
lib/tickets/export-conditions  the Queue's view and chips expressed as the server ConditionSet (base64url) for /v1/exports/tickets
components/tickets/export-menu  Export action (Excel, CSV) with the row-count toast and export.run telemetry
components/admin/audit-search, security-dashboard (CountList), usage-dashboard
components/portal/dashboard-strip  the client's own numbers on the portal home from /v1/portal/dashboard, client language
components/knowledge/   ArticleStatusPill and labels, ArticleEditor (eight sections, commit on blur), ArticleActions (submit,
                        publish, retire, generalize; refusals inline; FindingsSheet), VisibilityTab (whole-set save)
components/time/        Timesheet (week grouped by day, totals), weekOf and groupByDay helpers
lib/tickets/            vocab (seed fallback), use-catalogs (resolution codes, activity types and billable classes from
                        GET /v1/catalogs), priority preview matrix, sla helpers (tighter clock, local countdown, meter),
                        queue-views (system views and the URL grammar, breached is a server parameter), transition-errors
                        (typed 409 toasts), use-transition
lib/attachments/        uploadAttachment (presign, PUT or POST form, confirm; stages and typed refusals), formatBytes,
                        scanChip and originLabel (desk and portal copy), the quarantine placeholders
components/admin/       AdminGate (fails closed), GrantsReconcile (whole-set save), PermissionChecklist (implied keys
                        ticked and greyed), AccountSettingsTab (AI section gated on ai:configure), IntakeTab (aliases with state
                        pills and the loop guard reason), status pills, buttons
components/admin/connectors/  pills (health, mode, map state, outcome, link state on the signal trios), health-list,
                        add-servicenow-form, account-connectors-tab, instance-header (ModeSwitch, KillSwitchControl,
                        TestConnectionButton), settings-tab (SettingsForm, WatermarkPanel), map-lifecycle (useMapLifecycle:
                        select, draft, save, validate, activate), map-versions, field-map-editor, field-map-tab,
                        state-map-editor, state-map-tab, pairs-editor, runs-tab, dead-letters-tab, reason-dialog
components/tickets/sync-card  the rail's Sync card (external record link, link state, mode notice, conflict fields, last runs)
lib/connectors/         vocab (XMS field table, tone maps, externalRecordUrl), errors (typed 409 and 400 bodies),
                        use-connector-errors
lib/admin/              apiError/describeError (typed error bodies) and useMutationErrors (stale_version toasts + refetch)
app/(portal)/portal/    the client portal (P2.16.3) inside its own light chrome (never the internal shell):
                        / search-first home (own requests plus the knowledge placeholder), /sign-in (dev token paste,
                        Clerk SignIn when configured), /requests (Open or All, org-wide toggle with
                        portal:view-org-tickets), /requests/new (default form per type, inline validation),
                        /requests/[key] (public thread, composer, Files card with upload and scan states, cancel, confirm closure,
                        reopen); /requests/new queues files and uploads them after the request exists
components/portal/      PortalChrome (account name and accent, nav, user menu, 401 redirect), SearchHome, RequestList,
                        RequestForm (validateRequest), RequestThread and CommentComposer, RequestDetail, primitives
                        (ClientStatusPill, PortalCard, buttons and inputs), attachments (PortalUploadControl, PortalAttachmentList,
                        client scan copy). Renders portal view models only; nothing
                        from components/tickets or app/(internal) is imported here
lib/portal/             client-language (the seven client statuses, type and level copy, priority words, relative time)
test-kit/portal.tsx     constructed portal fixtures, the fetch stub and renderPortal for the portal tests
test-kit/desk.tsx       renderDesk (store plus toasts) for desk component tests, re-exporting the fetch stub
components/shell/       FinderBar, FinderOverlay, PinnedSidebar, ContentHeaderBar (HeaderFilters, HeaderAction portals),
                        CommandPalette, NotificationsMenu (bell dropdown, 60 s unread poll), Shell, ScreenStub
components/xms/         the house composition components (P1.4.2), one file each, import by path, no barrel
components/providers.tsx  Redux store, Clerk (when configured), theme, toasts, telemetry
lib/routes.ts           the route registry: path, screen id, section, permission; visibleScreens fails closed;
                        PORTAL_SCREENS carries the portal screen ids for telemetry only
lib/conditions.ts       the condition-set grammar (serialise, parse, describe)
lib/auth/               dev-mode switch (throws in production builds) and the TokenProvider registry
lib/telemetry/          TelemetryClient (batching, keepalive, catalog), ScreenViews, useTrack, request-id memory
lib/persisted-set.ts    per-browser pins, stars and history for the shell
lib/axel-client/        (P1.7.4) the SSE streaming client for the Axel adapter
redux/                  api.ts (base API, me endpoint), adminApi.ts (Accounts & Administration endpoints and types),
                        ticketsApi.ts (tickets, transitions with optimistic list and record patches, messages, timeline,
                        links, watchers, notifications, directory lookups), portalApi.ts (the /v1/portal mirror and the
                        searchArticles placeholder), knowledgeApi.ts (articles, drafts, publish, retire, generalize,
                        visibility, feedback, search, the Solutions rail, candidates, catalogs), timeApi.ts (ticket time,
                        my timesheet, adjustments, contract position, buckets), attachmentsApi.ts (list, presign, confirm, download,
                        delete for the desk and the portal mirror), emailApi.ts (ticket email, raw inbound, quarantine list
                        and decide, account aliases), connectorsApi.ts (instances, health, create ServiceNow, patch, test
                        connection, samples, field and state map lifecycle, kill switch, watermark, runs, dead letters,
                        ticket sync; useConnectorInstance selects the record out of the health list),
                        store.ts, hooks.ts, me.ts (useMe)
styles/tokens/          the four token layers
e2e/                    Playwright golden paths; tickets.spec.ts runs only with E2E_API_TOKEN (see its header)
```

Environment: `NEXT_PUBLIC_API_BASE_URL` (API origin, also in the CSP), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (enables Clerk),
`NEXT_PUBLIC_AUTH_DEV_MODE=true` (dev token paste; refused in production builds). See `.env.example`.
