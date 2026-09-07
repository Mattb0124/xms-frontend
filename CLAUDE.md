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
                        /roster (P2.12.1, CAP-01: Count-card list with role, FTE, zone, group and skill chips, URL filters, Import from
                        directory, New person; capacity:view) and /roster/[id] (Details with changed-fields PATCH, Calendar, Skills
                        whole-set save, Certifications with expiry tone);
                        /knowledge Solutions list (chips, search, New article), /knowledge/new, /knowledge/[key] (record bar,
                        section editor, Visibility, History, Feedback, Submit, Publish, Retire, Generalize with the findings
                        sheet) (P2.15.1, P2.15.2); /time My timesheet (week picker over /v1/timesheets/me, expected against logged per
                        day with the unlogged highlight, week and unlogged totals, quick Log time; time:log) (P2.12.x, P2.18.3);
                        the Log time form (ticket Time tab and the timesheet) takes an optional Start time sent as performed_start
                        and hides the person's own after-hours statement while one is given; entry rows carry the after-hours
                        badge (class, the contract's handling in words, the multiplier when not 1) (TB-13);
                        /operations (P2.19.3: period switcher, synthesis line, six tiles, SLA meters, outcomes, backlog by age,
                        open by priority and type, notable tickets, per-account strip; needs reports:view-portfolio),
                        /accounts (granted accounts with open counts from the strip when permitted), /accounts/[id] (one account:
                        the same panels, "View as client" re-fetches as_client=true and shows only what came back, Reports card
                        with runs and "Generate weekly report", Comp time panel over /v1/accounts/:id/time/comp-time by date
                        range with per-person minutes and entries; tickets:view, left out of the client view; a Budget link to
                        the account record's Budget tab under admin:accounts) (TB-13),
                        /reports/packs/[id] (frozen numbers, narrative, PPTX link),
                        /admin/audit (P2.11.5: condition builder over the three streams, results, record drawer with old and new
                        values, "Show this request" pivot, Load more, Export CSV with audit:export), /admin/security and
                        /admin/usage (P2.19.4 tiles and count lists); the Queue has an Export menu (Excel, CSV) over the current
                        view and chips (P2.11.4),
                        /admin overview and the built admin screens (P1.4.3, P1.4.4): /admin/accounts(+/[id]),
                        /admin/users(+/[id]), /admin/roles(+/[id]), /admin/groups(+/[id]), /admin/config (read only); the
                        account record has an Intake tab (inbound aliases, enable and disable, add) (P1.6.5), a Calendars tab (list
                        with the default marked, New calendar), a Contracts tab (key, name, model, status, after-hours
                        handling and the budget rules under tickets:view; under contracts:manage an inline rules editor per
                        row: handling with its multiplier, overage rule with the multiplier only under allow_rate, rollover
                        rule with the cap only under cap, thresholds as a comma list, notify client, forecast window, saved
                        as one set through PATCH with the version; multiplier_required, cap_required and stale_version
                        worded; a Rate cards panel beneath with a disclosure per contract listing its versions and an
                        Account default section, New version form under contracts:manage over PUT /v1/accounts/:id/rate-cards
                        with rate_card_exists and duplicate_role worded) (TB-05, TB-09, TB-11, TB-13), a Budget tab
                        (`?tab=budget` opens it, the target of the threshold notifications; tickets:view, fails closed: one
                        card per active contract from /v1/accounts/:id/budget with consumed against available, the burn bar
                        amber from the first fired threshold and red once over, a tick per threshold with the fired ones
                        marked and the next named, the fixed forecast sentence, the unrated-minutes note, and a drill-through
                        of the entries filtered by person, activity and billable class over the period with total minutes and
                        amount; Export disabled until an export route exists) (TB-07 to TB-09), a Connectors
                        tab (instances, Add ServiceNow instance with the credential shown once) (P2.21.4) and a Configuration
                        tab (admin:config, fails closed: the six catalogs with the effective source Default or Override and
                        its version, or "Nothing active" when effective is null with the editor still usable from an empty
                        object, a JSON body editor per kind with client-side parse, Save as override sending { body },
                        the server's invalid_config problems listed, Remove override with the version history and the
                        operator default underneath, a ticket-type scope selector for the state machine) (P2.9.2);
                        /admin/migration (P2.22.2, admin:migration: Batches list with account, object kind and status as URL
                        filters, a Reconciliation tab over the filtered account, New batch), /admin/migration/new (full-screen
                        form: account, object kind, source kind, instance from the account's connectors, range, dry run on by
                        default; prefills from ?account_id&instance_id&opened_from&opened_to&supersedes), /admin/migration/[id]
                        (counts, properties, run progress polling every 10 s while moving, Run with confirm and the reason when
                        it is off, Records with status filter, search and the record drawer with the source payload, Log,
                        Reconciliation with Explain on delta_open lines and Sign off disabled from the server's can_sign and
                        sign_blocker in words, refusals on a stale view in the server's words; people are named through
                        run_by_name, signed_by_name and explained_by_name, never id prefixes);
                        /admin/accounts/[id]/calendars/new and /admin/calendars/[id] (P3.26.1, TM-06: CalendarEditor with the week
                        grid, holiday library, make default, retire; PreviewPanel), /admin/holiday-calendars (libraries list and create);
                        /admin/connectors (health overview across granted accounts, admin:connectors) and /admin/connectors/[id]
                        (header with mode switch, kill switch, Test connection; tabs Settings with the watermark rewind, Field map,
                        State map, Runs, Dead letters with replay and discard) (P2.21.4, SN-07 to SN-09),
                        /dev/tokens (token check), /dev/sign-in (dev-mode token paste only)
components/tickets/     ticket-columns (the Queue column set), transition-menu (state pill menu, pause, resolve, confirm sheets),
                        resolve-form (close discipline mirror over the catalog codes), solution-picker (search over published
                        articles), solutions-rail (matching articles with Use this, similar tickets, resolution records, propose
                        an article), time-tab (entries with adjustments, the AfterHoursBadge with the contract's rule from the
                        account's contracts, the EntryAmount and the Over budget pill; LogTimeForm with Start time and the
                        overage_blocked refusal worded), contract-card (burn from the position),
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
components/time/        Timesheet (the week from /v1/timesheets/me: day rows with dayTone and dayStatus, entries with the start
                        time and the after-hours badge, header totals), TimeTodayCard (My work: today from
                        /v1/timesheets/me/unlogged, hidden without time:log), AfterHoursBadge (class pill, the handling in
                        words when the contract is known, the multiplier when not 1), CompTimePanel (per-person comp time by
                        range; tickets:view), weekOf and groupByDay helpers; entry-amount (EntryAmount: amount and the frozen
                        rate, nothing when unrated; OverBudgetPill), budget-view (AccountBudgetView fails closed on
                        tickets:view, ContractBudgetCard, BurnBar with threshold ticks and legend), budget-entries
                        (BudgetEntriesList: person, activity, class and range filters sent to the API, totals, disabled Export)
lib/time/after-hours    class and handling labels, describeHandling ("Premium 1.5x per contract", "Comp time"),
                        formatMultiplier, hasPremium, startTimeLabel, isStartTime (HH:MM 24-hour)
lib/time/budget         formatHours ("1.5 h"), formatMoney and formatAmount, budgetTone (good, warn, breach), consumedPercent,
                        forecastSentence and forecastBasis, thresholdMarkers and thresholdLabel, unratedNote, the overage and
                        rollover vocab (OVERAGE_RULES, ROLLOVER_RULES, describeOverage, describeRollover), overageBlockedMessage
components/admin/contracts/  account-contracts-tab (DenseTable of contracts with handlingCell and rulesCell,
                        ContractRulesEditor over patchContract with draftFromContract, parseThresholds, validateRules and
                        rulesBody; multiplier_required, cap_required and stale_version worded), rate-cards (RateCardsPanel with
                        a disclosure per contract and the Account default section, NewRateCardForm with validateRateCard and
                        toRateCardBody, describeRateCardError for rate_card_exists and duplicate_role)
lib/tickets/            vocab (seed fallback), use-catalogs (resolution codes, activity types and billable classes from
                        GET /v1/catalogs), priority preview matrix, sla helpers (tighter clock, local countdown, meter),
                        queue-views (system views and the URL grammar, breached is a server parameter), transition-errors
                        (typed 409 toasts), use-transition
lib/attachments/        uploadAttachment (presign, PUT or POST form, confirm; stages and typed refusals), formatBytes,
                        scanChip and originLabel (desk and portal copy), the quarantine placeholders
components/admin/       AdminGate (fails closed), GrantsReconcile (whole-set save), PermissionChecklist (implied keys
                        ticked and greyed), AccountSettingsTab (AI section gated on ai:configure), IntakeTab (aliases with state
                        pills and the loop guard reason), status pills, buttons
components/admin/time-zone-field  searchable IANA zone input over a datalist, plain text where the list is unavailable
components/admin/calendars/  account-calendars-tab, calendar-editor (calendarPatch diff), hours-grid, preview-panel
                        (PreviewResultView), holiday-libraries (list, create form, parseHolidayLines)
lib/calendars/          errors (typed invalid_time_zone, invalid_hours with problems, bad_start), hours (the week grid grammar:
                        parseHHMM, gridToHours with the server-worded checks, hoursToGrid, formatInZone, viewerTimeZone)
components/roster/      people-list (PeopleList, SkillChip, GroupChip), new-person-form, import-button, details-tab (changedFields),
                        calendar-tab, skills-tab (LevelControl, whole-set save), certifications-tab (ExpiryPill)
lib/roster/             vocab (ROLE_OPTIONS, roleLabel, SKILL_LEVELS, ISO_WEEKDAYS, expiryState, formatPercent), filters (the
                        list URL grammar), errors (typed person_exists, day_end_before_start, skill_exists, duplicate_skill ...)
components/xms/signal-pill  SignalPill on the --state-* trios for non-ticket signals (expiry, active, default)
components/admin/connectors/  pills (health, mode, map state, outcome, link state on the signal trios), health-list,
                        add-servicenow-form, account-connectors-tab, instance-header (ModeSwitch, KillSwitchControl,
                        TestConnectionButton), settings-tab (SettingsForm, WatermarkPanel), map-lifecycle (useMapLifecycle:
                        select, draft, save, validate, activate), map-versions, field-map-editor, field-map-tab,
                        state-map-editor, state-map-tab, pairs-editor, runs-tab, dead-letters-tab, reason-dialog
components/admin/migration/  pills (batch, record, line, report status and dry run on the signal trios), batch-list,
                        new-batch-form, batch-summary (CountsStrip, RunProgress, BatchProperties, LogTab), records-tab
                        (RecordDrawer), reconciliation-tab (ReportPanel per report, signOffBlockedReason, Explain through
                        ReasonDialog with fieldLabel), migration-pages.test (the three pages: gating, URL filters, Run states)
lib/migration/          vocab (statuses, tones, RUNNING and RUNNABLE sets, runBlockedReason, object and source kinds, range
                        and source copy, formatDelta), errors (typed bad_range, no_active_field_map, batch_not_runnable,
                        report_signed, signer_ran_batch, delta_open, not_found by entity), filters (the list URL grammar)
components/admin/config/  account-config-tab (KindRow per catalog with its effective pill), override-editor
                        (EffectiveSourcePill, BodyEditor keyed on the effective version id, VersionHistory)
lib/admin/config-catalog  the six kinds, their scopes (state machine per ticket type), formatBody and parseBody
lib/admin/config-errors  typed invalid_config with the server's problems, unknown_config_kind, config_missing, not_found
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
redux/                  api.ts (base API, me endpoint), adminApi.ts (Accounts & Administration endpoints and types, plus
                        getAccountConfig (effective may be null when nothing is active), setAccountOverride and
                        removeAccountOverride on the AccountConfig tag),
                        migrationApi.ts (batches with filters and run_by_name, create, one batch with its report, run, records
                        with status and search, one record with its payload, reconciliation reports with signed_by_name,
                        explained_by_name, can_sign and sign_blocker, explain, sign-off; tags MigrationBatches,
                        MigrationBatch, MigrationRecords, Reconciliation),
                        ticketsApi.ts (tickets, transitions with optimistic list and record patches, messages, timeline,
                        links, watchers, notifications, directory lookups, account contracts with after_hours_handling,
                        after_hours_multiplier and the budget rules (threshold_percents, threshold_notify_client, overage_rule,
                        overage_multiplier, rollover_rule, rollover_cap_hours, forecast_window_days), patchContract with the
                        version over the whole rule set), portalApi.ts (the /v1/portal mirror and the
                        searchArticles placeholder), knowledgeApi.ts (articles, drafts, publish, retire, generalize,
                        visibility, feedback, search, the Solutions rail, candidates, catalogs), timeApi.ts (ticket time,
                        my timesheet, adjustments, contract position, buckets; entries carry performed_start,
                        after_hours_class, rate_multiplier, rate_snapshot, amount and over_budget, LogTimeBody takes
                        performed_start, compTime reads the account's comp-time report by range and refreshes when time is
                        logged; accountBudget and budgetEntries (the API's contract, person, activity, class, from and to
                        parameters) on the Budget tag, refreshed when time is logged or adjusted; rateCards per contract or
                        the account defaults and createRateCard on the RateCards tag), attachmentsApi.ts (list, presign, confirm, download,
                        delete for the desk and the portal mirror), emailApi.ts (ticket email, raw inbound, quarantine list
                        and decide, account aliases), connectorsApi.ts (instances, health, create ServiceNow, patch, test
                        connection, samples, field and state map lifecycle, kill switch, watermark, runs, dead letters,
                        ticket sync; useConnectorInstance selects the record out of the health list),
                        rosterApi.ts (people list with filters, create, import, record, patch, calendar, skills catalog and
                        per-person whole-set skills, certifications), calendarsApi.ts (account calendars, one calendar, create,
                        patch, preview, holiday libraries), timeApi.ts also myWeek and myUnlogged (P2.18.3),
                        store.ts, hooks.ts, me.ts (useMe)
styles/tokens/          the four token layers
e2e/                    Playwright golden paths; tickets.spec.ts runs only with E2E_API_TOKEN (see its header)
```

Environment: `NEXT_PUBLIC_API_BASE_URL` (API origin, also in the CSP), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (enables Clerk),
`NEXT_PUBLIC_AUTH_DEV_MODE=true` (dev token paste; refused in production builds). See `.env.example`.
