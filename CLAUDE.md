@AGENTS.md

# XMS frontend (`xms-web`)

The Next.js and React application for XMS (Xelerated Managed Services): the internal desk at `xms.<domain>` (route group `app/(internal)`) and the client portal at `portal.<domain>` (route group `app/(portal)`). The specification set lives in the sibling `xms` spec repository (`01-architecture/USER-EXPERIENCE.md`, `DESIGN-SYSTEM.md`, `WIREFRAMES.md`, and section 6 of every `02-modules/*/TECHNICAL-SPEC.md`); this repository holds only the application.

## Rules that override defaults here

- **Security first (ADR-16).** Load the `xms-security-first` skill before designing, coding or reviewing. No authorisation decisions in the browser; no secrets or server-only values in `NEXT_PUBLIC_*`; CSP enforced; telemetry carries identifiers and structured facts, never ticket, email or article text.
- **The wireframes are the UI source of truth (ADR-17, ADR-18).** Navy finder bar, pinned sidebar, content header bar with removable filter chips, Count-card dense lists with no row striping, the v3 state ramp, 3px type bars, account identity dots, IBM Plex Mono for keys and SLA values, violet for AI-origin content only. Skills: `xms-web-design-system`, `xms-web-data-table`, `xms-web-ui-component`.
- **Tokens live in `styles/tokens`.** `aiinnovation-tokens.css` is vendored and never edited; `house.css` holds the `--aix-*` aliases and `--state-*` signal trios; `xms-scope.css` holds the identity; `theme.css` is the Tailwind v4 bridge (there is no `tailwind.config.js`). No raw hex in components.
- **The server is the only author of truth.** SLA due times, breach latches, derived priority, burn-down and permissions arrive from the API; the browser renders and counts down. Where a figure needs its basis to be read correctly, the label carries it ("Remaining of plan"), never a recomputation in the browser.
- **A gated screen asks nothing before the gate decides.** The component that renders `<AdminGate>` may not call a query hook: the body lives in a child the gate mounts once the permission is held, so no screen takes a 403, and writes a security event, before drawing its own refusal. `components/admin/fail-closed.test.ts` scans every page for it. The same test carries the contracts:view map: the contracts, rate cards, budget, account time and billing period routes are guarded by `contracts:view`, which Consultants and Dispatchers do not hold, so every surface reading one gates on that key and never a weaker one, and the account tabs leave those entries out. Only the contract position stayed on `tickets:view`, so the ticket record's contract card did too.
- **Panels read eyebrow, title, subtitle.** `Panel`'s `caption` is a short ALL-CAPS noun phrase; whatever explains the panel goes in `subtitle`, in sentence case. Read-only record values are text with a tooltip, never disabled inputs. `components/xms/panel.test.tsx` holds `components/capacity` and `components/time` to the eyebrow rule.
- **Build fails on lint or type errors.** `scripts/check-next-config.mjs` rejects `ignoreBuildErrors` and `ignoreDuringBuilds`; the pipeline gate runs `pnpm check` before any image is built.
- Tests are **Vitest** (unit and component) and **Playwright** (golden paths in `e2e/`); every `*.test.ts(x)` is discovered, there is no allowlist.
- No em-dashes in copy; ServiceNow vocabulary where it aids adoption (CS keys, work notes, resolution codes).

## Tracked security exception

**TODO: replace `'unsafe-inline'` in `script-src` with a per-request nonce.**
The App Router inlines the flight payload and the bootstrap script into every
server-rendered document, so the CSP in `next.config.ts` cannot drop
`'unsafe-inline'` without emitting a nonce from a `middleware.ts` and using
`script-src 'self' 'nonce-<n>' 'strict-dynamic'`. Until that lands, the CSP is
a host allowlist and a clickjacking control, not an XSS control, and the
comment beside the policy says so. What keeps the residual risk bounded, and
must stay true: no HTML-injection sink anywhere (no `dangerouslySetInnerHTML`,
no `innerHTML`, no markdown renderer), every `href`, `window.open` and download
target built from server data validated through `lib/safe-url`, and no cookie
authentication. Security review 2026-09-08, findings 25 and 26.

## Commands

- `pnpm dev`, `pnpm build`, `pnpm start`
- `pnpm check` runs lint, type-check, the Prettier check, the config check and unit tests (the pre-PR gate). `pnpm format` writes what `format:check` reads; a gate that skipped formatting was a gate that lied about being green.
- `pnpm test`, `pnpm test:e2e`
- `pnpm generate:api-types` regenerates `src/api-types` from the backend's `openapi.json` (set `XMS_OPENAPI_PATH`)

## Layout (as built 2026-09-08, capacity and billing cut with the skills matrix and forward demand, then CSAT and report schedules, then API clients and the finance connector, per ADR-14, then the 2026-09-08 review's fidelity pass)

```
app/layout.tsx          fonts, .xms-scope, Providers
app/(internal)/         the desk inside the Shell: / My work (scorecards, brief line, time today, the Waiting on me rail,
                        needs attention, my open tickets),
                        /tickets Queue (system views, chips, condition trail, Count card in the prototype's column order and
                        opening on SLA, selection bar, cursor paging, rows per page), /tickets/new (record form
                        with the priority preview), /tickets/[key] (record bar, transition menu, Properties with the matrix
                        caption on the Priority row and one Assignee control, Conversation,
                        Activity, Time, Resolution, Links, Email, rail with Service levels (target, elapsed, remaining and the
                        paused segment with its reason), Attachments, Solutions, Contract, Requester,
                        Watching), /tickets/dispatch (cards per account) (P1.5.5, P2.12.4 basics), /tickets/quarantine
                        (held email: reason, stripped body, decide with confirm on the destructive ones; P1.6.5);
                        /roster (P2.12.1, CAP-01: Count-card list with role, FTE, zone, group and skill chips, URL filters, Import from
                        directory, New person; capacity:view) and /roster/[id] (Details with changed-fields PATCH, Calendar, PTO
                        (CAP-02: list with kind, full or half days and note, add form sending fraction 0.5 only for half days,
                        Remove with confirm; shown to the person themselves (me.userId equals user_id) or under capacity:manage,
                        the API not asked otherwise; invalid_range worded), Skills whole-set save, Certifications with expiry tone);
                        /capacity (CAP-03, CAP-04; capacity:view, fails closed: month, role, group and account in the URL and sent
                        as the API names them, one row per person with the server's available, allocated, actual and remaining
                        hours and the status pill Available, Near capacity, Over, No calendar, the totals row, one column per
                        account present with the planned hours editable inline under capacity:manage and saved as one PUT
                        /v1/allocations with the version each cell was read at and its note kept, 0 clearing the cell,
                        stale_version worded as Reloaded with the drafts dropped, Add account over the granted accounts; the
                        account and group directories need tickets:view, else columns carry the short id; the totals row
                        carries the server's remaining total; beneath the grid the demand overlay (CAP-08): allocated,
                        weighted pipeline and project demand stacked against the available hours with the figures, the
                        verdict against the remaining hours and the subjects, or a link to enter demand when the month has
                        none), /capacity/variance (CAP-05: month, account and person in the URL, planned, actual, variance in
                        signed hours and whole percent, largest first, totals with the signed variance total; Export disabled
                        until the API has a route), /capacity/skills (CAP-07, functional 5.8; capacity:view, fails closed: the
                        lens and its filter in the URL, the people lens a heat map of people against the active skills grouped
                        by kind with the level 1 to 4 on the accent ramp and a role filter, the account lens one card per
                        account with each required technology, its status pill Covered, Single point of failure or Gap and
                        the qualified people, an account filter sent to the API, names from the skills catalog with the code
                        standing in) and /capacity/demand (CAP-08, functional 5.7; capacity:view, fails closed: from and to
                        months in the URL (the current month to three months ahead by default) and an account, the lines
                        with source pill, subject, month, hours, probability for pipeline, weighted hours, role and note, the
                        server's totals, Remove behind a confirm under capacity:manage, the Add demand form with the
                        probability only for pipeline and subject_required worded, the Import CSV panel taking pasted text or
                        a file read as text with the template columns listed, invalid_import per line and unknown_account
                        keys worded); the assignee
                        picker under tickets:work asks GET /v1/capacity/check once per open picker (at most 50 roster ids) and
                        shows "76.8 h left", "Over by 13.3 h" or "No calendar" with a warning marker for warning and over (CAP-06);
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
                        range with per-person minutes and entries; contracts:view, left out of the client view) as the Dashboard
                        tab, a Budget tab (`?tab=budget`, the target of the threshold notifications, so a reader with
                        contracts:view and no admin:accounts reaches the same AccountBudgetView, the tab not offered without it) (TB-13), and a Satisfaction
                        tab (`?tab=satisfaction`, CP-07 results per account; tickets:view, fails closed: the average score,
                        the responses in range, the low-score count, the surveys sent, answered and suppressed, the
                        distribution as five bars from very satisfied down sized against the largest count, and the
                        responses newest first with the score pill, the ticket link, the comment, the respondent by name and
                        address or Anonymous, and the date, over a from and to range with the API's ninety-day default), with the skills
                        coverage chips above the tabs under capacity:view ("Single point of failure: OneStream", "Gap: SAP"
                        from the account lens; hidden when nothing is flagged) (CAP-07),
                        /reports/packs/[id] (frozen numbers, narrative, PPTX link),
                        /admin/audit (P2.11.5: condition builder over the three streams, results, record drawer with old and new
                        values, "Show this request" pivot, Load more, Export CSV with audit:export), /admin/security and
                        /admin/usage (P2.19.4 tiles and count lists); the Queue has an Export menu (Excel, CSV) over the current
                        view and chips (P2.11.4),
                        /admin overview and the built admin screens (P1.4.3, P1.4.4): /admin/accounts(+/[id]),
                        /admin/users(+/[id]), /admin/roles(+/[id]), /admin/groups(+/[id]), /admin/config (read only),
                        /admin/api-clients (Accounts & Administration functional 5.9, Integrations functional 5.4;
                        admin:api-clients, which admin:users implies, fails closed: the list with the name, the expiry
                        or "No expiry", the key prefix, the scopes as chips, how many accounts the client may read,
                        last used or "Never used" and the status pill Active or Revoked; New client over GET
                        /v1/admin/api-clients/scopes as checkboxes with the server's descriptions and the viewer's
                        granted accounts as checkboxes, named from the account directory under admin:accounts and by
                        short id otherwise, with an optional expiry, refused locally before the API when the name,
                        a scope or an account is missing; the key from the create response in a copy box that says it
                        will not be shown again and never reaches the list; Revoke behind a confirm with
                        already_revoked worded; a note that webhook subscriptions are registered by the client itself
                        through the API with its key, since /v1/webhooks answers API client principals only); the
                        account record carries the same skills coverage chips under the record bar (capacity:view; CAP-07)
                        and has an Intake tab (inbound aliases, enable and disable, add) (P1.6.5), a Calendars tab (list
                        with the default marked, New calendar), a Contracts tab (key, name, model, status, after-hours
                        handling and the budget rules under contracts:view; under contracts:manage an inline rules editor per
                        row: handling with its multiplier, overage rule with the multiplier only under allow_rate, rollover
                        rule with the cap only under cap, thresholds as a comma list, notify client, forecast window, the
                        required technology codes as a comma list (lower-cased, deduplicated, the server's code pattern, up
                        to fifty; listed by name in a Technologies column), saved as one set through PATCH with the
                        version; multiplier_required, cap_required and stale_version
                        worded; a Rate cards panel beneath with a disclosure per contract listing its versions and an
                        Account default section, New version form under contracts:manage over PUT /v1/accounts/:id/rate-cards
                        with rate_card_exists and duplicate_role worded) (TB-05, TB-09, TB-11, TB-13), a Budget tab
                        (`?tab=budget` opens it, the target of the threshold notifications; contracts:view, fails closed: one
                        card per active contract from /v1/accounts/:id/budget with consumed against available, the burn bar
                        amber from the first fired threshold and red once over, a tick per threshold with the fired ones
                        marked and the next named, the fixed forecast sentence, the unrated-minutes note, and a drill-through
                        of the entries filtered by person, activity and billable class over the period with total minutes and
                        amount; Export disabled until an export route exists) (TB-07 to TB-09), a Billing tab (functional 5.7,
                        TB-14; contracts:view, fails closed: one period per calendar month with the status pill Open, Submitted,
                        Approved, Locked, Exported, who submitted, approved and locked it by name with the day (System for
                        the automatic lock), the summary the server kept (hours, amount, entries and adjustments, by
                        class, unrated hours) and the checksum prefix; New period from a month picker under time:lock-period;
                        Submit and Reopen under contracts:manage, Approve and Lock under time:lock-period behind a confirm, each
                        posting { version } to its own route; invalid_transition worded with the allowed moves and stale_version
                        as Reloaded, the list read again either way; CSV and Excel for a locked or exported period under
                        time:lock-period fetched with the bearer through lib/exports/download, period_not_locked worded, the
                        period and its export records read again after a file; an Exports disclosure listing each finance file
                        with rows, checksum prefix and delivery state), a Report packs tab (`?tab=reports`; Dashboards
                        functional 5.7, DR-05; reports:manage, fails closed: the schedules from GET /v1/reporting/schedules
                        ?account= with the cadence worded with its day and time ("Weekly on Monday at 06:00"), the period,
                        the next run or Not scheduled, the recipients and the Enabled pill; New schedule and Edit through one
                        form (name, cadence with the period following it until chosen, run day under the weekly 1 to 7 rule
                        checked before the API and run_day_weekly worded after it, run time, period, recipients as internal
                        user or portal user picked from the directories or a contact by email and name, enabled) posted as
                        the create body or PATCHed as the whole set with the version, stale_version worded as Reloaded with
                        the form closed and the list read again; Run now per schedule with an optional period_start and
                        period_end (both or neither, the end never before the start, invalid_range worded) showing the
                        period, the status, Open pack and the outcome per recipient as Notified, Emailed or Skipped with the
                        reason in words; the runs from GET /v1/reporting/runs?account= newest first with the schedule name
                        or "Generated by hand", Scheduled or On demand, the status pill, the error, the delivery summary
                        ("1 notified, 1 skipped") with a Details disclosure, and Open pack when the run carries a pack_id;
                        notifications of type report.pack.ready link to the existing /reports/packs/[id]), a Connectors
                        tab (instances, Add ServiceNow instance with the credential shown once) (P2.21.4), a Finance tab
                        (Integrations functional 5.3, INT-02; two halves, each failing closed on its own permission and
                        neither asking the API without it: the destination under admin:connectors over GET and PUT
                        /v1/finance/destinations/:accountId with the kind as a radio, the endpoint URL for HTTPS or the
                        object prefix for the object store, the format and Enabled, keyed on the record's version so a
                        save reseeds the form, the signing key in force named and the new secret shown once in a copy
                        box when the response carries one, with invalid_endpoint per problem (invalid_url, not_https,
                        private_host), endpoint_required and prefix_required worded; the deliveries under
                        time:lock-period from GET /v1/finance/deliveries?account_id= newest first with the period named
                        from the Billing list, the destination kind and manifest key, the status pill Pending,
                        Delivered, Acknowledged, Failed or Superseded, the acknowledgement reference and time or
                        "Not acknowledged", the response status, the error and the supersedes marker; Deliver now over
                        the account's locked or exported periods posting { period_id } alone, with period_not_locked
                        naming the status and no_destination worded, and a note when contracts:view is missing so the
                        periods cannot be listed) and a Configuration
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
components/tickets/     ticket-columns (the Queue column set and QUEUE_DEFAULT_SORT), work-area-tabs (the record's tab
                        order), transition-menu (state pill menu, pause, resolve, confirm sheets),
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
                        accounts-list, reports-card (runs, RunStatusPill, generate), report-pack, csat-panel (AccountCsatView
                        fails closed on tickets:view: the figures, DistributionBars, the responses table, the date range)
lib/reporting/          csat (defaultCsatRange, formatAverage, distributionRows from very satisfied down against the largest
                        count, respondentLabel, scoreTone), schedules (CADENCES, PERIOD_KINDS, RECIPIENT_KINDS, WEEKDAYS,
                        maxRunDay, defaultPeriodKind, cadenceLabel, nextRunLabel, recipientLabel, the ScheduleDraft with
                        emptyScheduleDraft, draftFromSchedule, validateSchedule (WEEKLY_RUN_DAY_MESSAGE), scheduleBody and
                        patchBody with the version, validateRunNow and runNowBody, OUTCOME_LABELS, outcomeTone, reasonLabel,
                        deliverySummary, requestedByLabel, scheduleError and describeScheduleError for run_day_weekly,
                        stale_version, invalid_range and not_found)
components/admin/reports/  report-schedules-tab (ReportSchedulesTab, DeliveryList; the schedule form with RecipientRow over
                        the internal and portal user directories, RunNowPanel, RunsHistory)
components/admin/api-clients/  api-clients-view (ApiClientsView, ApiClientStatusPill, ScopeChips, NewKeyPanel: the key in a
                        copy box until it is dismissed by hand)
components/admin/finance/  finance-tab (AccountFinanceTab, DestinationForm over DestinationEditor keyed on the record's
                        version, NewSecretPanel, DeliveriesPanel with Deliver now, DeliveryStatusPill)
lib/integrations/       api-clients (API_CLIENT_STATUS, the ApiClientDraft with emptyApiClientDraft, toggle,
                        validateApiClient and apiClientBody, lastUsedLabel, expiryLabel, accountLabel, apiClientError
                        and describeApiClientError for already_revoked and not_found), finance (DESTINATION_KINDS,
                        FINANCE_FORMATS, DELIVERY_STATUS, DELIVERABLE_STATUSES and isDeliverable, the DestinationDraft
                        with emptyDestinationDraft, draftFromDestination and destinationBody (only the chosen kind's
                        field is sent), secretKidLabel, responseStatusLabel, acknowledgementLabel, financeError and
                        describeFinanceError for invalid_endpoint with its problem, endpoint_required,
                        prefix_required, period_not_locked with the status and no_destination)
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
                        range; contracts:view), weekOf and groupByDay helpers; entry-amount (EntryAmount: amount and the frozen
                        rate, nothing when unrated; OverBudgetPill), budget-view (AccountBudgetView fails closed on
                        contracts:view, ContractBudgetCard, BurnBar with threshold ticks and legend), budget-entries
                        (BudgetEntriesList: person, activity, class and range filters sent to the API, totals, disabled Export)
lib/time/after-hours    class and handling labels, describeHandling ("Premium 1.5x per contract", "Comp time"),
                        formatMultiplier, hasPremium, startTimeLabel, isStartTime (HH:MM 24-hour)
lib/time/budget         formatHours ("1.5 h"), formatMoney and formatAmount, budgetTone (good, warn, breach), consumedPercent,
                        forecastSentence and forecastBasis, thresholdMarkers and thresholdLabel, unratedNote, the overage and
                        rollover vocab (OVERAGE_RULES, ROLLOVER_RULES, describeOverage, describeRollover), overageBlockedMessage
components/admin/contracts/  account-contracts-tab (DenseTable of contracts with handlingCell, rulesCell and the Technologies
                        column, ContractRulesEditor over patchContract with draftFromContract, parseThresholds,
                        parseTechnologyCodes, validateRules and rulesBody (technology_codes with the rule set);
                        multiplier_required, cap_required and stale_version worded), rate-cards (RateCardsPanel with
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
                        calendar-tab, pto-tab (canWritePto, ptoBody, rangeLabel; the list and form only for self or
                        capacity:manage), skills-tab (LevelControl, whole-set save), certifications-tab (ExpiryPill)
lib/roster/             vocab (ROLE_OPTIONS, roleLabel, SKILL_LEVELS, ISO_WEEKDAYS, expiryState, formatPercent), filters (the
                        list URL grammar), errors (typed person_exists, day_end_before_start, skill_exists, duplicate_skill ...)
components/capacity/    capacity-grid (CapacityGrid: presentAccounts, changedCells with versions and notes, StatusPill, inline
                        cells, Save allocations, Add account, the remaining total), capacity-tabs (the four link-tabs:
                        Capacity, Planned versus actual, Skills matrix, Demand), skills-heat-map (SkillsHeatMap, heatMapRows;
                        columns grouped by kind, cells on levelCellClass), account-coverage (AccountCoverageCards,
                        CoveragePill, useSkillName over the skills catalog with the code as the fallback), coverage-chips
                        (AccountCoverageChips: the account lens for one account under capacity:view, nothing when nothing is
                        flagged), demand-overlay (DemandOverlay, overlayWidths: the stacked bar, the figures, the verdict,
                        the subjects), demand-table (DemandTable, SourcePill, totals, Remove behind a confirm), demand-form
                        (AddDemandForm, emptyDemandDraft, validateDemand, demandBody: probability only for pipeline as a
                        fraction, the subject once), demand-import (ImportDemandPanel: textarea or file read as text, the
                        template columns, invalid_import problems per line)
lib/capacity/           vocab (PTO kinds and fractionLabel, CAPACITY_STATUS labels and tones, formatSignedHours,
                        formatVariancePercent, remainingLabel, month helpers currentMonth, monthStart, monthEnd, monthLabel,
                        addMonths, isMonth, the cell text conversions; COVERAGE_STATUS and coverageChipLabel, levelCellClass
                        and groupSkillsByKind for the heat map; DEMAND_SOURCE, weightedMinutes (the server's rule),
                        formatProbability, demandSubject, DEMAND_TEMPLATE_COLUMNS and DEMAND_TEMPLATE_EXAMPLE), filters (the
                        four screens' URL grammar: the month written only when it is not the current one, the skills lens
                        written only for account with each lens keeping its own filter, the demand range written only where
                        it leaves the current month plus three), errors (typed invalid_range, bad_month, person_ids_required,
                        stale_version with current, forbidden with account_id, not_found by entity, bad_lens,
                        subject_required, invalid_import with problems, unknown_account with keys)
components/admin/billing/  billing-periods-tab (BillingPeriodsTab, BillingStatusPill, BillingExportsList, PeriodPeople with
                        the submitted, approved and locked names)
lib/time/billing        BILLING_STATUS, BILLING_TRANSITIONS with the permission per move, allowedActions, canExport,
                        billingPeriodBody, periodLabel, checksumPrefix, billingError and describeBillingError
                        (invalid_transition with status and allowed, stale_version, period_not_locked)
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
                        reopen); /requests/new queues files and uploads them after the request exists;
                        /surveys (CP-07, functional 5.7: the pending ticket-close surveys as cards with the key, the
                        description, the expiry, the one question with five buttons labelled very dissatisfied to very
                        satisfied, an optional comment and Send my answer; the completed ones with their score; "No surveys
                        pending."; already_answered and survey_closed worded with the list read again) and /surveys/[id]
                        (with `?token=`, the email link: the one question alone, no chrome, no session, posted to
                        POST /v1/csat/:id/answer with the token; with a session and no token the Surveys page with that
                        survey first, or a notice when it was already answered or is no longer open)
components/portal/      PortalChrome (account name and accent, nav with Surveys, user menu, 401 redirect; renders only the
                        main column when isSurveyLink matches, skipping /portal/me), SearchHome, RequestList,
                        RequestForm (validateRequest), RequestThread and CommentComposer, RequestDetail, primitives
                        (ClientStatusPill, PortalCard, buttons and inputs), attachments (PortalUploadControl, PortalAttachmentList,
                        client scan copy), survey-question (SurveyQuestion: the five buttons, the comment, the submit
                        disabled until a score), surveys (SurveysPage with focusId), survey-link (SurveyLinkAnswer).
                        Renders portal view models only; nothing
                        from components/tickets or app/(internal) is imported here
lib/portal/             client-language (the seven client statuses, type and level copy, priority words, relative time),
                        csat (SCORES, SCORE_LABELS, scoreLabel, surveyQuestion, isSurveyLink, expiryLabel, surveyError and
                        describeSurveyError for already_answered, survey_closed with its status, not_found, token_required)
test-kit/portal.tsx     constructed portal fixtures (aPortalMe, aPortalTicket, aTimeline, aSurvey, anAnsweredSurvey), the
                        fetch stub and renderPortal for the portal tests
test-kit/reporting.ts   dashboard, audit and report fixtures, plus aCsatSummary, aSchedule, aRun, aDelivery, SCHEDULE_ID
                        and INTERNAL_USER_ID
test-kit/integrations.ts  constructed API client and finance fixtures (anApiClient, aScope, someScopes, aDestination,
                        aFinanceDelivery) with the ids API_CLIENT_ID, FINANCE_ACCOUNT_ID, OTHER_ACCOUNT_ID and
                        BILLING_PERIOD_ID; no live key, endpoint or account
test-kit/desk.tsx       renderDesk (store plus toasts) for desk component tests, re-exporting the fetch stub
test-kit/my-work.ts     constructed My work fixtures (aWaitingItem, aWaiting)
components/my-work/     waiting-rail (WaitingRail over GET /v1/me/waiting: a row per item with a non-zero count linking to
                        the address lib/my-work/waiting-links resolves for its key, never the server's link;
                        "Nothing is waiting on you" when none is; hidden entirely, with no error, while the route
                        answers 404 or 501, so My work keeps working before the backend deploys; waitingRows and
                        isNotDeployed)
lib/my-work/waiting-links  WAITING_TARGETS (the item key to a lib/routes screen id and its search) and waitingHref: the
                        API answers /queue, /timesheet, /notifications and /reports/runs, which this desk does not
                        serve, so the key is resolved through the registry against the screens this viewer may see; a
                        key mapped to no screen (notifications live in the shell's bell) and a screen the viewer may
                        not open both read as text, and only a key the registry has never heard of falls back to the
                        server's link, through lib/safe-url
components/shell/       FinderBar, FinderOverlay, PinnedSidebar, ContentHeaderBar (HeaderFilters, HeaderAction portals),
                        CommandPalette, NotificationsMenu (bell dropdown, 60 s unread poll), Shell, ScreenStub
components/xms/         the house composition components (P1.4.2), one file each, import by path, no barrel;
                        Panel takes caption (eyebrow), title and subtitle; DenseTable takes defaultSort and makes an
                        openable row a tab stop that opens on Enter or Space; RecordForm renders a read-only field as
                        wrapping text with a tooltip and takes a per-field hint
components/providers.tsx  Redux store, Clerk (when configured), theme, toasts, telemetry
lib/routes.ts           the route registry: path, screen id, section, permission; visibleScreens fails closed;
                        PORTAL_SCREENS carries the portal screen ids for telemetry only
lib/conditions.ts       the condition-set grammar (serialise, parse, describe)
lib/auth/               dev-mode (DEPLOY_TARGET and readDeployTarget, IS_LOCAL_TARGET, AUTH_DEV_MODE; throws at load when
                        the dev sign-in is asked for off the local target) and the TokenProvider registry, whose browser
                        storage is local-target only (security review finding 27)
lib/telemetry/          TelemetryClient (batching, keepalive, catalog), ScreenViews, useTrack, request-id memory
lib/persisted-set.ts    per-browser pins, stars and history for the shell
lib/axel-client/        (P1.7.4) the SSE streaming client for the Axel adapter
redux/                  api.ts (base API, me endpoint, waitingOnMe over /v1/me/waiting on the Waiting tag), adminApi.ts (Accounts & Administration endpoints and types, plus
                        getAccountConfig (effective may be null when nothing is active), setAccountOverride and
                        removeAccountOverride on the AccountConfig tag),
                        migrationApi.ts (batches with filters and run_by_name, create, one batch with its report, run, records
                        with status and search, one record with its payload, reconciliation reports with signed_by_name,
                        explained_by_name, can_sign and sign_blocker, explain, sign-off; tags MigrationBatches,
                        MigrationBatch, MigrationRecords, Reconciliation),
                        ticketsApi.ts (tickets, transitions with optimistic list and record patches, messages, timeline,
                        links, watchers, notifications, directory lookups, account contracts with after_hours_handling,
                        after_hours_multiplier and the budget rules (threshold_percents, threshold_notify_client, overage_rule,
                        overage_multiplier, rollover_rule, rollover_cap_hours, forecast_window_days) and technology_codes,
                        patchContract with the version over the whole rule set, invalidating SkillsMatrix), portalApi.ts (the
                        /v1/portal mirror, the searchArticles placeholder, portalSurveys with pending and answered,
                        answerPortalSurvey reloading the list even when refused, and answerSurveyLink posting the token to
                        /v1/csat/:id/answer on the PortalSurveys tag), reportingApi.ts also accountCsat with from and to on
                        the Csat tag, reportSchedules by account, createReportSchedule, patchReportSchedule with the version
                        (reloading the list either way), runScheduleNow with the optional period (reloading schedules, runs
                        and the account's Reports), and scheduleRuns by account, status and schedule on the ReportSchedules
                        and ReportRuns tags, apiClientsApi.ts (apiClients, apiClientScopes, createApiClient (the key
                        comes back once) and revokeApiClient, which reloads the list even when the API refuses, on the
                        ApiClients and ApiClientScopes tags), integrationsApi.ts (the finance connector:
                        financeDestination (null before one is set), setFinanceDestination (secret only when the API
                        mints one), financeDeliveries by account_id and period_id, and deliverPeriodNow sending
                        { period_id } and reloading the deliveries and the account's billing periods, on the
                        FinanceDestination and FinanceDeliveries tags), knowledgeApi.ts (articles, drafts, publish, retire, generalize,
                        visibility, feedback, search, the Solutions rail, candidates, catalogs), timeApi.ts (ticket time,
                        my timesheet, adjustments, contract position, buckets; entries carry performed_start,
                        after_hours_class, rate_multiplier, rate_snapshot, amount and over_budget, LogTimeBody takes
                        performed_start, compTime reads the account's comp-time report by range and refreshes when time is
                        logged; accountBudget and budgetEntries (the API's contract, person, activity, class, from and to
                        parameters) on the Budget tag, refreshed when time is logged or adjusted; rateCards per contract or
                        the account defaults and createRateCard on the RateCards tag; billingPeriods (with submitted_by_name,
                        approved_by_name and locked_by_name), createBillingPeriod,
                        transitionBillingPeriod (submit, reopen, approve, lock with { version }, the list reloaded even when
                        refused), billingExports and billingExportPath on the BillingPeriods and BillingExports tags),
                        capacityApi.ts (listPto, addPto, removePto on the Pto tag and the Capacity tag; capacityView with month,
                        group, role, account, carrying the demand overlay and the remaining total; capacityCheck with
                        person_ids capped at 50 and month; capacityVariance with month, account, person and the variance
                        total; skillsMatrixPeople (lens=people) and skillsMatrixAccount (lens=account, account) on the
                        SkillsMatrix tag, invalidated by the roster skills save and the contract patch; listDemand with from,
                        to, account, addDemand, removeDemand and importDemand ({ content }) on the Demand tag, each also
                        reloading Capacity; listAllocations; putAllocations invalidating Capacity and Allocations stale or
                        not), attachmentsApi.ts (list, presign, confirm, download,
                        delete for the desk and the portal mirror), emailApi.ts (ticket email, raw inbound, quarantine list
                        and decide, account aliases), connectorsApi.ts (instances, health, create ServiceNow, patch, test
                        connection, samples, field and state map lifecycle, kill switch, watermark, runs, dead letters,
                        ticket sync; useConnectorInstance selects the record out of the health list),
                        rosterApi.ts (people list with filters, create, import, record, patch, calendar, skills catalog and
                        per-person whole-set skills (invalidating SkillsMatrix), certifications), calendarsApi.ts (account
                        calendars, one calendar, create,
                        patch, preview, holiday libraries), timeApi.ts also myWeek and myUnlogged (P2.18.3),
                        store.ts, hooks.ts, me.ts (useMe)
styles/tokens/          the four token layers
e2e/                    Playwright golden paths; tickets.spec.ts runs only with E2E_API_TOKEN (see its header)
```

Environment: `NEXT_PUBLIC_API_BASE_URL` (API origin, also in the CSP), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (enables Clerk),
`NEXT_PUBLIC_DEPLOY_TARGET` (`local` | `dev` | `demo` | `production`; unset reads as `local` in a development build and
`production` in a built one) and `NEXT_PUBLIC_AUTH_DEV_MODE=true` (dev token paste; local target only, and the build
fails when it is on for any other). See `.env.example`.
