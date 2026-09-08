@AGENTS.md

# XMS frontend (`xms-web`)

The Next.js and React application for XMS (Xelerated Managed Services): the internal desk at `xms.<domain>` (route group `app/(internal)`) and the client portal at `portal.<domain>` (route group `app/(portal)`). The specification set lives in the sibling `xms` spec repository (`01-architecture/USER-EXPERIENCE.md`, `DESIGN-SYSTEM.md`, `WIREFRAMES.md`, and section 6 of every `02-modules/*/TECHNICAL-SPEC.md`); this repository holds only the application.

## Rules that override defaults here

- **Security first (ADR-16).** Load the `xms-security-first` skill before designing, coding or reviewing. No authorisation decisions in the browser; no secrets or server-only values in `NEXT_PUBLIC_*`; CSP enforced; telemetry carries identifiers and structured facts, never ticket, email or article text.
- **The wireframes are the UI source of truth (ADR-17, ADR-18).** Navy finder bar, pinned sidebar, content header bar with removable filter chips, Count-card dense lists with no row striping, the v3 state ramp, 3px type bars, account identity dots, IBM Plex Mono for keys and SLA values, violet for AI-origin content only. Skills: `xms-web-design-system`, `xms-web-data-table`, `xms-web-ui-component`.
- **Tokens live in `styles/tokens`.** `aiinnovation-tokens.css` is vendored and never edited; `house.css` holds the `--aix-*` aliases and `--state-*` signal trios; `xms-scope.css` holds the identity; `theme.css` is the Tailwind v4 bridge (there is no `tailwind.config.js`). No raw hex in components.
- **The server is the only author of truth.** SLA due times, breach latches, derived priority, burn-down and permissions arrive from the API; the browser renders and counts down. Where a figure needs its basis to be read correctly, the label carries it ("Remaining of plan"), never a recomputation in the browser.
- **A gated screen asks nothing before the gate decides.** The component that renders `<AdminGate>` may not call a query hook: the body lives in a child the gate mounts once the permission is held, so no screen takes a 403, and writes a security event, before drawing its own refusal. `components/admin/fail-closed.test.ts` scans every page for it. The same test carries the contracts:view map: the contracts, rate cards, budget, account time and billing period routes are guarded by `contracts:view`, which Consultants and Dispatchers do not hold, so every surface reading one gates on that key and never a weaker one, and the account tabs leave those entries out. Only the contract position stayed on `tickets:view`, so the ticket record's contract card did too. The same test carries the connector outbound queue, which the API answers to `admin:connectors` alone: every file calling `useListOutboundQuery` or `useRetryOutboundMutation` is listed with the screen whose gate mounts it. It carries the account's contacts the same way, which the API answers to `admin:accounts` alone: every file calling `useListContactsQuery` or `useSetContactFlagsMutation` is listed with the screen whose gate mounts it. It carries the held report run the same way, which the API answers to `reports:manage` alone: every file calling `useReviewRunQuery`, `useEditRunNarrativeMutation`, `useRegenerateReportRunMutation`, `useApproveReportRunMutation` or `useCancelReportRunMutation` is listed with the screen whose gate mounts it, and the registry entry for `/reports/runs/[id]` is pinned to that key so no weaker reader is offered the link. It carries the Queue's saved views the same way: `/v1/views` answers to `tickets:view`, the Queue's own gate, so the map exists to keep it there rather than to raise it. The analytics map now covers the audit's saved queries (five routes on `audit:read`, the key the search itself takes) and the Security screen's integrity route. Two maps were added with the 2026-09-08 group and time work, and both carry two keys rather than one, so each surface names its own: the routing defaults and the group catalog read under `tickets:view` and write under `admin:config` and `tickets:work`, and the non-ticket buckets read under `time:log` and write under `contracts:manage`. Neither write key is implied by its read key, and neither read key is implied by the account record's `admin:accounts` or its Contracts tab's `contracts:view`, which is why the routing panel and the buckets panel hold their own read gates instead of riding on the screen's. A map was added with the request forms (CP-03): all six form routes answer to `admin:config`, read and write alike, which `admin:accounts` does not imply, so the builder holds its own guard and every hook is pinned to the route it reads.
- **Panels read eyebrow, title, subtitle.** `Panel`'s `caption` is a short ALL-CAPS noun phrase; whatever explains the panel goes in `subtitle`, in sentence case. Read-only record values are text with a tooltip, never disabled inputs. `components/xms/panel.test.tsx` holds `components/capacity` and `components/time` to the eyebrow rule.
- **Build fails on lint or type errors.** `scripts/check-next-config.mjs` rejects `ignoreBuildErrors` and `ignoreDuringBuilds`; the pipeline gate runs `pnpm check` before any image is built.
- Tests are **Vitest** (unit and component) and **Playwright** (golden paths in `e2e/`); every `*.test.ts(x)` is discovered, there is no allowlist.
- **A test file never imports another test file.** Vitest registers a module's suites the moment it is imported, so a fixture taken out of `redux/timeApi.test.ts` re-ran that file's own `describe` blocks inside the importer: fifty-seven files did it and the gate reported 1744 tests over the 1013 that existed. Every shared builder lives in a `test-kit/*` module, which declares no suite at all, and `test-kit/shared-fixtures.test.ts` scans for both halves of that rule.
- No em-dashes in copy; ServiceNow vocabulary where it aids adoption (CS keys, work notes, resolution codes).

## The Content Security Policy

The CSP carries a **per-request nonce** and is therefore not in
`next.config.ts` at all: `lib/security/csp.ts` builds it and `proxy.ts`
sends it, setting the nonce on the request headers (where the framework reads
it, and where `@clerk/nextjs` reads `x-nonce` for its own script tag) and the
policy on the response. Nothing else may send a CSP: two policies on one
response are enforced as the intersection of both.

`script-src` is `'self' 'nonce-<n>' 'strict-dynamic'` plus the Clerk origins;
`'self'` and the origins are there for CSP2-only browsers, which ignore
`'strict-dynamic'`. `'unsafe-eval'` is added in development only.
`style-src` deliberately keeps `'unsafe-inline'`: `next/font` and next-themes
write inline styles that carry no nonce, and a nonce in `style-src` would
make `'unsafe-inline'` ignored and break the page. Inline style is not a
script-execution sink here, so the residual risk is style injection on a page
with no HTML-injection sink at all.

The root layout reads the nonce back out of the headers and passes it to
next-themes, the one inline script this tree writes itself. The file is
`proxy.ts` exporting `proxy`: Next 16.3 deprecated the `middleware`
convention and renamed it, and only the file and the export name changed,
not the request and response objects or the `config.matcher` grammar.

What must stay true, and is what kept the risk bounded before the nonce
landed: no HTML-injection sink anywhere (no `dangerouslySetInnerHTML`, no
`innerHTML`, no markdown renderer), every `href`, `window.open` and download
target built from server data validated through `lib/safe-url`, and no cookie
authentication. Security review 2026-09-08, findings 25 and 26; finding 25 is
closed.

## Commands

- `pnpm dev`, `pnpm build`, `pnpm start`
- `pnpm check` runs lint, type-check, the Prettier check, the config check and unit tests (the pre-PR gate). `pnpm format` writes what `format:check` reads; a gate that skipped formatting was a gate that lied about being green.
- `pnpm test`, `pnpm test:e2e`
- `pnpm generate:api-types` regenerates `src/api-types` from the backend's `openapi.json` (set `XMS_OPENAPI_PATH`)

## Layout (as built 2026-09-08, capacity and billing cut with the skills matrix and forward demand, then CSAT and report schedules, then API clients and the finance connector, per ADR-14, then the 2026-09-08 review's fidelity pass, then the ServiceNow connector's outbound half, then the quarterly relationship survey, the ticket scope flag and the account's contacts, then the PDF rendition and review before send, then the out-of-scope filter, the read behind the survey link, the Portfolio-wide audit filter, the records behind the Security dashboard rows, the editable narrative, then the server's saved views, the audit's saved queries, the integrity panel and the core-loop funnel, then the group queue with the routing defaults, the group catalog and the change calendar, non-ticket time, then the shared fixtures moved into test-kit and the per-account request forms, authored on the account and filled in on the portal)

```
proxy.ts                the per-request CSP nonce: sets it on the request headers and the response policy
lib/security/csp        contentSecurityPolicy, newNonce and NONCE_HEADER ("x-nonce"); the only CSP in the codebase
app/layout.tsx          fonts, .xms-scope, the nonce read back from the headers, Providers
app/(internal)/         the desk inside the Shell: / My work (scorecards, brief line, time today, the Waiting on me rail,
                        needs attention, my open tickets),
                        /tickets Queue (system views including Flagged out of scope, chips on seven dimensions (account, type,
                        priority, state and out_of_scope over the server's closed vocabulary none, flagged, approved,
                        declined, a value outside it dropped when the URL is read rather than sent for a 400, plus the two
                        group dimensions of TM-08: my_groups, the flag the server answers from the membership table, and
                        group_id, one assignment group. Neither is a comma list on the API, so a second chip on either
                        replaces the first and a hand-typed list is narrowed rather than sent; both compose with any view,
                        which a preset could not do), the
                        server's saved views in the same list under an optgroup (TM-08: selecting one writes its
                        conditions into the URL rather than sending its id to the list route, so the chips stay
                        removable and `saved=` only names which view is showing and is dropped the moment a criterion
                        changes; Save as view files the current chips under one account with a name and private,
                        one group or account sharing, and rename, resharing and delete are offered to the owner alone;
                        the group share names its group through the picker, since the API refuses one without a
                        share_ref, and a move away clears the reference; the group queue is saved as the server's own
                        is_mine on group_id, so a shared "my groups" view means the reader's groups and not the
                        saver's; the per-browser star stays the fallback while /v1/views answers 404 or 501), condition
                        trail, Count card in the prototype's column order and
                        opening on SLA, selection bar, cursor paging, rows per page), /tickets/new (record form
                        with the priority preview), /tickets/[key] (record bar, transition menu (TM-18: a window refusal
                        opens the change window sheet rather than only a toast, naming the freeze and its reason or the
                        tickets already holding the configuration item, and taking the reason that carries the move;
                        change_freeze and change_conflict are acknowledgements any worker may make, outside_change_window
                        and change_window_required are overrides offered to a holder of tickets:override-change-window
                        alone and worded to everyone else, and the reason travels as change_window_reason onto the
                        audit; a second refusal of the same reason is left to the toast), Properties with the matrix
                        caption on the Priority row and one Group control and one Assignee control (TM-08: reassignment is
                        to a group or to a person, a retired group is off the picker but kept while it is the value in
                        force, and group_retired is worded), Conversation,
                        Activity, Time, Resolution, Links, Email, rail with Service levels (target, elapsed, remaining and the
                        paused segment with its reason), Scope (TM-11: the flag state, its reason, who raised it and when,
                        and the decision with its note, its allowance in hours and who decided; Flag out of scope with a
                        required reason and Withdraw flag under tickets:work, Approve with an optional whole-minute
                        allowance and an optional note and Decline with a note under tickets:approve-scope, both hidden
                        from the flagger with the reason worded; ticket_closed, already_flagged, reason_required,
                        not_flagged, flagger_cannot_decide and no_contract_period naming its day, all in words; the card
                        is not drawn at all when the API answered without the block), Attachments, Solutions, Contract, Requester,
                        Watching), /tickets/dispatch (cards per account) (P1.5.5, P2.12.4 basics), /tickets/quarantine
                        (held email: reason, stripped body, decide with confirm on the destructive ones; P1.6.5);
                        /tickets/groups (TM-10; tickets:view, fails closed: the projects and change windows across the
                        granted accounts with the kind, the account, the schedule, the freeze count and the status, filters
                        on account, kind and status sent as the API names them, and the record form under tickets:work with
                        the two ends a change window needs, the freezes as rows of start, end and reason saved as the whole
                        set the API stores on the window, and the kind and the account frozen on an existing record;
                        invalid_schedule carries the server's own problems into the sentence),
                        /tickets/change-calendar (TM-18; tickets:view, fails closed: the month with one card per change
                        window, its freezes and the changes planned in it, the next window with the days to it, and above
                        them "right now" for one account from GET /v1/change-calendar/at, which reads the same rules the
                        transition gate uses, so inside, frozen and outside every window are the server's three answers and
                        not this screen's arithmetic; with several accounts granted and none chosen the line says which
                        question it cannot answer);
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
                        beneath the quick log, Log time without a ticket (TB-12): the account then the bucket, the same
                        form over the account's own catalogs, opening on the bucket's billable class rather than the
                        first activity's and saying whether that class consumes the contract; the buckets carry the
                        shared taxonomy (governance, qbr_prep, account_mgmt, escalation, custom), a retired one is off
                        the picker and bucket_retired is worded; an entry with no ticket is named on the timesheet by
                        its bucket, or as non-ticket time where the API sent no label;
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
                        distribution as five bars from very satisfied down sized against the largest count, the
                        responses newest first with the score pill, the ticket link, the comment, the respondent by name and
                        address or Anonymous, and the date, over a from and to range with the API's ninety-day default, and
                        beside them the quarterly relationship block (the latest period, the mean per question with the key
                        in words, and the four-period trend oldest first with each mean against the five-point scale), drawn
                        only when the API answers with one that has a period or a trend in it, since the two surveys ask
                        different questions and are never averaged into one number), with the skills
                        coverage chips above the tabs under capacity:view ("Single point of failure: OneStream", "Gap: SAP"
                        from the account lens; hidden when nothing is flagged) (CAP-07) and the renewal chips above them
                        under contracts:view (one per engagement the server marked expiring, red once inside the notice
                        period; hidden when none is),
                        /reports/packs/[id] (frozen numbers, narrative, the deck link and a Download PDF that mints
                        the PDF rendition on the click, since each one costs a data.export.produced event),
                        /reports/runs/[id] (DR-05, functional 5.8; reports:manage, fails closed: one held run, its
                        status and its deadline (a passed one says the grace period expired and nothing was sent),
                        the pack as the two renditions present it (Headline, Service levels, Backlog and notable
                        requests, Consumption, in the deck's own order, with "No activity this period" for a section
                        that carries nothing), Open PDF and Open slides over the presigned links the API minted, the
                        editable narrative panel (one box per section, the source of the words said above it from
                        narrative_source with "AI is off for this account" where ai_enabled is false, and Regenerate
                        with my edits, which PATCHes the narrative and POSTs the regenerate in one press and reads the
                        run again so the links are the ones minted against the files that now exist; while it holds the
                        prose the section panels carry the numbers alone and the Headline panel is not drawn, so no
                        paragraph is shown twice), Approve and send (enabled only with a saved edit) and Send without
                        changes (both approve, the API rebuilding an unrendered edit first), and Cancel with a required
                        reason; not_under_review naming the status the run now has, run_without_schedule,
                        run_without_pack, duplicate_section and the empty reason all in words),
                        /admin/audit (P2.11.5: condition builder over the three streams, results, record drawer with old and new
                        values, "Show this request" pivot, Load more, Export CSV with audit:export; the audit stream carries the
                        operator half since migration 0033, so a row with no account reads as Portfolio in the Account column
                        and carries an Operator chip taken from attrs.scope alone, never inferred from the null account. The
                        condition editor offers is_null and is_not_null on the seven nullable columns alone (account_id,
                        actor_id, principal_kind, entity_kind, entity_id, request_id, correlation_id), worded for the field
                        ("is Portfolio-wide" and "is any account" on the Account row), with no value control and no value
                        sent, since the API refuses one. Beneath the results the Saved queries panel over
                        /v1/audit/saved-queries: each query the reader can see (their own plus every shared one) with
                        how many conditions it carries, who saved it and whether it is shared; Run fills the same
                        results table, named by the query it came from, and Load more then pages through that query's
                        own run route rather than the inline search, going back to the inline search on the next
                        Search or request pivot; Load into builder puts the conditions back in the editor without
                        running; saving takes a name and a description, and the Share switch is offered only with
                        audit:export, since audit:read does not imply it; rename and delete are the owner's alone; a
                        query that is gone is worded as deleted or unshared and never as forbidden, because the API
                        answers the same 404 to both),
                        /admin/security (P2.19.4, XA-03: sign-in failures, denials, isolation probes, admin changes, exports and
                        downloads, abuse by kind, the clients the rate limiter turned away, what is paused right now, the
                        quarantined files and the open dead letters, each as a tile and a panel under the window selector. A
                        figure the API did not send is left out, tile and panel both, never printed as a zero; the paused and
                        dead-letter figures say they read the present rather than the window, and both tiles read the API's own
                        roll-ups (paused_integrations_by_reason, open_dead_letters_by_queue) while the rows below them are one
                        record each. Rows link only where a screen answers them and only for a reader who holds its permission:
                        rate-limited clients to /admin/api-clients, a tripped instance to /admin/connectors/[id] by its own id,
                        a dead-letter queue to that instance's Dead letters tab by instance_id, a paused webhook subscription
                        to /admin/accounts/[id], since a subscription is registered by the client itself through the API and
                        this desk serves no screen for one, and a row naming no record to nothing at all. The dead-letter tile
                        is deliberately wider than its rows: the depth per queue is operator wide and the rows are bound to the
                        reader's grants, and the panel says so. The Integrity panel over
                        /v1/dashboards/security/integrity replaces the old placeholder: the digest chain per stream
                        with its last digested day, row count, hash head and what the last verification said (a stream
                        never verified reads as never verified on the warning trio, never as passing, and a mismatch
                        leads the whole panel on the breach trio), the archive in cold storage per stream, the events
                        this reader can see per stream with their span, and the retention months said to be the
                        declared policy with detach_job_built repeated in words, so a promise is never printed as a
                        measurement; a block the API omits is left out and a route it does not serve draws no panel) and
                        /admin/usage (P2.19.4, XA-03: the roll-up tiles and count lists, then the core-loop funnel as a
                        step strip (opened, first reply, time logged, solution linked, resolved, closed) with the count,
                        a bar against the largest step and the server's own drop-off in words, a negative one worded
                        with its reason rather than clamped, since a step is not a subset of the one before; the
                        per-account funnel in the same step order, busiest first, each account opening /accounts/[id];
                        the adoption table by role with the action, the people and times in the window and the
                        first-use date that reaches past it, the API's unassigned row reading as "No role assigned";
                        then the per-account strip as a Count
                        card sorted on tickets created, busiest first, with tickets closed, time logged in hours, portal
                        sign-ins, API client calls and active users, each account name opening /accounts/[id]; the strip,
                        the funnel and the adoption table are each left out entirely where the API does not answer them);
                        the Queue has an Export menu (Excel, CSV) over
                        the current view and chips (P2.11.4),
                        /admin overview and the built admin screens (P1.4.3, P1.4.4): /admin/accounts(+/[id]),
                        /admin/users(+/[id]), /admin/roles(+/[id]), /admin/groups(+/[id]), /admin/config (read only),
                        /admin/api-clients (Accounts & Administration functional 5.9, Integrations functional 5.4;
                        admin:api-clients, which admin:users implies, fails closed: the list with the name, the expiry
                        or "No expiry", the key prefix, the scopes as chips, how many accounts the client may read,
                        the rate limit as "600 / min", last used or "Never used" and the status pill Active or Revoked;
                        New client over GET
                        /v1/admin/api-clients/scopes as checkboxes with the server's descriptions and the viewer's
                        granted accounts as checkboxes, named from the account directory under admin:accounts and by
                        short id otherwise, with an optional expiry and the rate limit opening on the API's own default
                        of 600 a minute, refused locally before the API when the name,
                        a scope or an account is missing or the rate limit is not a whole number from 1 to 100000; the
                        key from the create response in a copy box that says it
                        will not be shown again and never reaches the list; Revoke behind a confirm with
                        already_revoked worded; a note that webhook subscriptions are registered by the client itself
                        through the API with its key, since /v1/webhooks answers API client principals only); the
                        account record carries the same skills coverage chips under the record bar (capacity:view; CAP-07)
                        and has a Contacts tab (CP-07, Client Portal technical 2.1; admin:accounts, the screen's own gate,
                        so nothing is asked before it decides: every person the account writes to with their address,
                        whether they hold a portal user, and the flags they carry as checkboxes over
                        executive_sponsor (the flag the quarterly survey addresses), billing_contact and csat_recipient,
                        each set one box at a time but PATCHed as the whole set with the row's version, a search sent as
                        `q`, stale_version worded and the list read again; a flag a newer API adds is still offered and
                        still shown, since losing one quietly is how someone stops receiving the survey),
                        an Intake tab (inbound aliases, enable and disable, add) (P1.6.5), a Calendars tab (list
                        with the default marked, New calendar), a Contracts tab (an Engagements panel first: name, owner,
                        renewal date, notice period with its decide-by date, status pill and alerts fired, with New
                        engagement and Edit under contracts:manage; then the contracts (key, name, engagement, model,
                        status, after-hours
                        handling and the budget rules) under contracts:view; under contracts:manage an inline rules editor per
                        row: the engagement it is filed under, handling with its multiplier, overage rule with the
                        multiplier only under allow_rate, rollover
                        rule with the cap only under cap, thresholds as a comma list, notify client, forecast window, the
                        required technology codes as a comma list (lower-cased, deduplicated, the server's code pattern, up
                        to fifty; listed by name in a Technologies column), saved as one set through PATCH with the
                        version; multiplier_required, cap_required and stale_version
                        worded; a Rate cards panel beneath with a disclosure per contract listing its versions and an
                        Account default section, New version form under contracts:manage over PUT /v1/accounts/:id/rate-cards
                        with rate_card_exists and duplicate_role worded; and a Non-ticket buckets panel last (TB-12): the
                        label, the key, the shared taxonomy, the class with whether it consumes the contract, and the
                        status, with Edit under contracts:manage sending the version; the list itself answers to time:log,
                        which neither this tab's contracts:view nor the screen's admin:accounts implies, so the panel holds
                        its own read gate, and a bucket is not created here because the API takes a key on a closed
                        pattern) (TB-05, TB-09, TB-11, TB-12, TB-13), a Budget tab
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
                        or "Generated by hand", Scheduled or On demand, the status pill, the review pill on the signal
                        trios beside it (Ready for review needs-input, Awaiting review overdue, nothing at all for a
                        run review never touched), the error, the delivery summary
                        ("1 notified, 1 skipped") with a Details disclosure, Open pack when the run carries a pack_id
                        and Review on every held run; the schedules list marks the ones whose runs are held (with the
                        grace period on the pill's title) and says "Sends on run" for the rest, and the form carries the
                        review switch with a sentence in the schedule's own grace hours (never the grace period itself:
                        the patch leaves it out, so a deadline a reviewer was told about cannot move); a held Run now
                        says it was held, states the deadline and links the review rather than claiming anything was
                        sent;
                        notifications of type report.pack.ready link to the existing /reports/packs/[id], and
                        report.review.requested and report.review.overdue to /reports/runs/[id]), a Connectors
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
                        operator default underneath, a ticket-type scope selector for the state machine; and beneath it the
                        Routing defaults (TM-08), which are configuration too but whose read the API answers to
                        tickets:view: the type, the category (blank meaning the type as a whole, and a category rule
                        winning over it on the server) and the group, added and removed as a draft of the whole set and
                        saved with one PUT under admin:config so a rule cannot be half-saved, with a rule naming no group
                        and two rules covering the same type and category refused before the API is asked; the panel is
                        drawn for a tickets:view reader without admin:config, read only, since the catalogs above are not;
                        and last the Request forms (CP-03), one per ticket type, whose six routes all answer to
                        admin:config, which admin:accounts does not imply, so the panel holds its own gate and asks
                        nothing without it: the forms per type with the published version beside each, that version read
                        only (the label, the key, the kind, whether it is required, the ticket field or custom key it
                        writes and its condition, which is what a client is asked right now), and the draft beneath,
                        held as one definition and saved as one body so a field cannot be half-saved. A field carries a
                        kind over the server's twelve, a label, a key, required, the options of a choice, where the
                        answer goes (only the columns that kind may write, then custom.<key>, which follows the key when
                        it is renamed) and a condition on an answer to a conditionable field asked earlier, offered from
                        that field's own answers. Every rule the server enforces is run first, so a problem reads beside
                        the field rather than arriving as a 400: the key pattern, a duplicate key, two fields writing the
                        same place, a kind writing a column it may not, a choice with no options, one attachment field
                        at most and never a required one, and urgency and impact together or neither. Publish is behind
                        a confirmation that says the version freezes, that a request being filled in keeps the version
                        it started on and that the next change is a new draft; it is refused while the draft in hand is
                        unsaved. New form is offered for a type with no active form, and form_already_exists,
                        form_version_published and invalid_form_definition are all worded) (P2.9.2, CP-03);
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
                        /admin/connectors (health overview across granted accounts, admin:connectors; the outbound pending and
                        dead-lettered columns are unconditional now that the health route answers them on every instance, and a
                        row that arrives without a count prints a blank, never a zero it did not read)
                        and /admin/connectors/[id]
                        (the gate holds a child, so nothing is asked before admin:connectors is decided; header with mode switch,
                        kill switch, Test connection; the mode switch offers bidirectional, says what the promotion still needs
                        before the click (field map, state map, credential) and leaves the server's own refusal
                        (no_active_field_map, no_active_state_map, credential_not_valid) beside it; tabs Settings with the
                        watermark rewind, Field map, State map, Runs, Dead letters with replay and discard, and Outbound (the
                        instance's queue: event, ticket key, status pill, attempts, next attempt while pending, last error, and
                        the conflict outcome with its kept and dropped fields, each drop naming its policy and reason, on expand;
                        Retry on a failed or dead-lettered row, worded as requeued or already queued). The tab and the queue's
                        status filter are in the URL (`?tab=outbound&status=failed`)) (P2.21.4, SN-03 to SN-05, SN-07 to SN-09),
                        /dev/tokens (token check), /dev/sign-in (dev-mode token paste only)
components/tickets/     ticket-columns (the Queue column set and QUEUE_DEFAULT_SORT), work-area-tabs (the record's tab
                        order), transition-menu (state pill menu, pause, resolve, confirm sheets),
                        resolve-form (close discipline mirror over the catalog codes), solution-picker (search over published
                        articles), solutions-rail (matching articles with Use this, similar tickets, resolution records, propose
                        an article), time-tab (entries with adjustments, the AfterHoursBadge with the contract's rule from the
                        account's contracts, the EntryAmount and the Over budget pill; LogTimeForm with Start time and the
                        overage_blocked refusal worded), contract-card (burn from the position),
                        scope-card (ScopeCard on the rail and ScopeState: the flag and the decision as the record carries
                        them, the flag form, the decision form with its allowance and note, and the flagger's own refusal),
                        resolution-tab, conversation-tab (Composer with Reply / Work note), activity-tab, links-tab,
                        properties-panel, sla-rail (meters with countdown, requester, watch from the record), assignee-picker,
                        attachments (DropZone, useUploads, UploadList, ScanAcknowledgement, AttachmentRow, AttachmentsCard; the
                        composer blocks Send while a scan is pending; P1.6.2), email-panel (inbound with matched_by and
                        disposition copy, loop signals, View raw; outbound with delivery state)
components/reporting/   format (percent, hours, period, age buckets, periods), period-switcher, measure-panels (TileStrip, SlaPanel,
                        OutcomesPanel, BacklogPanel, BreakdownPanel, NotablePanel, ConsumptionPanel, synthesisLine; each renders
                        only when its measure is present so the client view reuses them), operations-dashboard, account-dashboard,
                        accounts-list, reports-card (runs, RunStatusPill over the whole run vocabulary including the four
                        review states, generate), report-pack (both renditions: the deck as a link, the PDF minted on the
                        click), delivery-list (DeliveryList, shared by the Report packs tab and the review screen),
                        run-review (ReportRunReview: the run's facts, the decisions, and one panel per pack section),
                        csat-panel (AccountCsatView
                        fails closed on tickets:view: the figures, DistributionBars, the responses table, the date range;
                        QuarterlyPanel beside it, rendered only when the API answers with a quarterly block)
lib/reporting/          csat (defaultCsatRange, formatAverage, distributionRows from very satisfied down against the largest
                        count, respondentLabel, scoreTone; hasQuarterly, quarterlyQuestionRows (the server's question order,
                        else the order the averages arrived), quarterlyTrendRows (each mean against the five-point scale)
                        and latestPeriodLabel), review (DR-05, functional 5.8: REVIEW_STATE_LABELS and runStatusLabel,
                        isHeld, reviewPill on the signal trios, reviewMoment and deadlineLine (a passed deadline says
                        nothing was sent), packSections reading the frozen pack in the deck's own section order (each
                        section carrying its narrative key, and the prose passed in rather than read out, so the screen
                        can hold it in the editor instead) with
                        EMPTY_SECTION_LINE and isEmptySection, latestNarrative, the narrative panel's own vocabulary
                        (NARRATIVE_SECTIONS, narrativeSectionsOf (the run's sections, else the pack's newest version as
                        the headline), narrativeDraft, narrativeBody (every key once, in the deck's order),
                        narrativeChanged, hasSavedEdit, needsRegenerate, narrativeSourceLine and
                        UNRENDERED_EDIT_NOTE), CANCEL_REASON_MESSAGE, reviewError with
                        the status the run now has, and describeReviewError for not_under_review, run_without_schedule,
                        run_without_pack and duplicate_section), schedules (CADENCES, PERIOD_KINDS, RECIPIENT_KINDS, WEEKDAYS,
                        maxRunDay, defaultPeriodKind, cadenceLabel, nextRunLabel, recipientLabel, the ScheduleDraft with
                        emptyScheduleDraft, draftFromSchedule, validateSchedule (WEEKLY_RUN_DAY_MESSAGE), scheduleBody and
                        patchBody with the version (review_required in both, review_grace_hours in neither),
                        DEFAULT_REVIEW_GRACE_HOURS and reviewRequiredNote,
                        validateRunNow and runNowBody, OUTCOME_LABELS, outcomeTone, reasonLabel,
                        deliverySummary, requestedByLabel, scheduleError and describeScheduleError for run_day_weekly,
                        stale_version, invalid_range and not_found)
components/admin/reports/  report-schedules-tab (ReportSchedulesTab, ReviewPill, and DeliveryList re-exported from
                        components/reporting/delivery-list; the schedule form with RecipientRow over
                        the internal and portal user directories and the review switch, RunNowPanel, RunsHistory)
components/admin/api-clients/  api-clients-view (ApiClientsView, ApiClientStatusPill, ScopeChips, NewKeyPanel: the key in a
                        copy box until it is dismissed by hand)
components/admin/forms/  ticket-forms-panel (TicketFormsPanel holding its own admin:config gate, TicketFormsEditor with
                        the forms per type and NewFormForm, FormEditor with the published version read only and the draft
                        as one saved definition, FieldEditor per field and the publish confirmation)
components/admin/finance/  finance-tab (AccountFinanceTab, DestinationForm over DestinationEditor keyed on the record's
                        version, NewSecretPanel, DeliveriesPanel with Deliver now, DeliveryStatusPill)
lib/admin/ticket-forms  the builder's draft grammar (CP-03): TicketForm and TicketFormVersion, the FieldDraft with
                        emptyFieldDraft, draftFromField, draftFromDefinition and definitionFromDraft (a boolean
                        condition written back as a boolean, an option list only for the kinds that take one),
                        mapsToOptions and CUSTOM_PREFIX, controllersFor, validateFormDraft (every check the server makes,
                        run first so a problem reads beside the field), publishedVersion, draftVersion, versionLabel,
                        PUBLISH_FREEZES_NOTE, formError and describeFormError for invalid_form_definition with the
                        server's own problems, form_already_exists and form_version_published
lib/integrations/       api-clients (API_CLIENT_STATUS, DEFAULT_RATE_LIMIT (600) and MAX_RATE_LIMIT, the ApiClientDraft
                        with emptyApiClientDraft opening on the default rate, toggle,
                        validateApiClient and apiClientBody, lastUsedLabel, expiryLabel, rateLimitLabel, accountLabel,
                        apiClientError
                        and describeApiClientError for already_revoked and not_found), finance (DESTINATION_KINDS,
                        FINANCE_FORMATS, DELIVERY_STATUS, DELIVERABLE_STATUSES and isDeliverable, the DestinationDraft
                        with emptyDestinationDraft, draftFromDestination and destinationBody (only the chosen kind's
                        field is sent), secretKidLabel, responseStatusLabel, acknowledgementLabel, financeError and
                        describeFinanceError for invalid_endpoint with its problem, endpoint_required,
                        prefix_required, period_not_locked with the status and no_destination)
lib/exports/            fetchDownload (bearer fetch to a blob, filename from Content-Disposition, x-row-count), saveBlob (object
                        URL and a temporary anchor), downloadFile; presigned pack URLs never come through here
lib/tickets/export-conditions  the Queue's view and chips expressed as the server ConditionSet (base64url) for /v1/exports/tickets
lib/tickets/saved-views  the /v1/views grammar both ways: SavedViewDefinition, definitionFromParams (paramsToExportSpec
                        with the account folded into the conditions, since a view has no account parameter),
                        applyDefinition (the conditions back as the Queue's view, chips and search box, with each
                        system view recognized from the preset it stands for and every one of them round-tripping;
                        anything the chip grammar cannot say is named in `notes`, as is a view naming no state, which
                        the Queue must narrow to open), savedViewSearch (the address, with `saved=` naming the view),
                        SHARE_MODES (private and account; group needs a share_ref the Queue cannot pick),
                        validateSavedView, describeSavedViewError (not_owner, invalid_conditions, share_ref_required,
                        stale_version, not_found) and isNotDeployed (404 or 501 alone)
components/tickets/saved-views  useSavedViews (the list, and whether the route answered at all), savedViewLabel and
                        SavedViewsBar (Save as view with the name, account and sharing; rename, resharing and delete
                        for the owner; the per-browser star as the fallback while the route is not deployed)
components/tickets/export-menu  Export action (Excel, CSV) with the row-count toast and export.run telemetry
components/admin/audit-search (scopeOf and accountLabel: the Operator chip from attrs.scope, Portfolio for a null
                        account; rowsToQuery and rowsFromConditions, which reads a saved query back into the builder
                        with a datetime in the control's local wording rather than the ISO instant),
                        saved-queries (SavedQueriesPanel: the list, Run, Load into builder, save, rename and delete),
                        security-dashboard (CountList, whose rows carry an optional href), integrity-panel
                        (IntegrityPanel: the chain, the archive, the streams and the retention policy),
                        usage-dashboard (the per-account strip), usage-funnel (FunnelPanel with the step strip and the
                        per-account table, AdoptionPanel)
lib/reporting/saved-queries  the SavedQueryDraft with emptySavedQueryDraft and draftFromSavedQuery, validateSavedQuery
                        (the API's 120 and 500 character limits, at most twenty conditions, and no saving an empty
                        builder), savedQueryBody, ownerLabel and savedQueryLine, isOwner, SHARING_NEEDS_EXPORT and
                        describeSavedQueryError (not_found worded as deleted or unshared, never as forbidden, since
                        the API answers the same 404 to a query that is gone and to someone else's private one)
lib/reporting/integrity  momentLabel, digestLabel, bytesLabel, verificationLine (never verified is a warning, not a
                        pass), chainSummary (a mismatch leads), archiveLine, spanLine and retentionLines (the months
                        as the declared policy, with detach_job_built said in words)
lib/reporting/usage      FUNNEL_STEPS and stepLabel, dropOffLine (a negative drop-off worded with its reason, since a
                        step is not a subset of the one before), stepWidth, stepsByKey, roleLabel (unassigned reads as
                        "No role assigned") and firstUsedLabel
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
components/admin/contracts/  engagements-panel (EngagementsPanel above the contracts list: name, owner (named from the
                        internal directory under admin:users, the short id otherwise), renewal date, notice period with
                        its decide-by date, the status pill Active, Expiring or Ended, and which renewal alerts have
                        fired; New engagement and Edit under contracts:manage over one EngagementForm, the status
                        control on an edit only and sent only when it was changed by hand so a moved renewal date can
                        still decide it; renewal_date_required and stale_version worded, the list read again either
                        way), renewal-chip (AccountRenewalChips on the account dashboard header: one chip per
                        engagement the server marked expiring, "Hosting renewal renews in 23 days", amber until the
                        notice period is entered and red after it; contracts:view, nothing rendered when nothing is
                        expiring),
                        account-contracts-tab (DenseTable of contracts with handlingCell, rulesCell, the Engagement
                        column and the Technologies
                        column, ContractRulesEditor over patchContract with draftFromContract, the engagement picker
                        (an emptied picker sends engagement_id null, never undefined), parseThresholds,
                        parseTechnologyCodes, validateRules and rulesBody (technology_codes with the rule set);
                        multiplier_required, cap_required and stale_version worded), rate-cards (RateCardsPanel with
                        a disclosure per contract and the Account default section, NewRateCardForm with validateRateCard and
                        toRateCardBody, describeRateCardError for rate_card_exists and duplicate_role)
lib/contracts/engagements  ENGAGEMENT_STATUS labels and tones, renewalLabel, noticeLabel and noticeDeadline, alertsLabel
                        (0 reads as the notice period), ownerLabel and engagementName, expiringEngagements with
                        renewalChipLabel, renewalChipTone and renewalChipTitle, the EngagementDraft with
                        emptyEngagementDraft, draftFromEngagement, validateEngagement (NOTICE_NEEDS_RENEWAL, the
                        server's renewal_date_required refused first), engagementBody (null, never an empty string) and
                        patchEngagementBody (the status only when changed by hand), engagementError and
                        describeEngagementError
lib/tickets/            vocab (seed fallback), use-catalogs (resolution codes, activity types and billable classes from
                        GET /v1/catalogs), priority preview matrix, sla helpers (tighter clock, local countdown, meter),
                        queue-views (system views and the URL grammar, breached is a server parameter; OUT_OF_SCOPE and
                        outOfScopeLabel, CHIP_KEYS with out_of_scope among them, and the Flagged out of scope view),
                        transition-errors
                        (typed 409 toasts), use-transition, scope (TM-11: SCOPE_STATES and SCOPE_LABELS with scopeTone,
                        isFlagged, allowanceLabel (minutes as hours), actorLabel (the server's name, never an id),
                        decisionBlockedReason (the flagger, and nothing pending), flagBody, withdrawBody, decisionBody
                        (an allowance only as a whole number of minutes above zero, never with a decline), validateFlag
                        and validateDecision, scopeError and describeScopeError for all six refusal codes plus
                        stale_version)
lib/attachments/        uploadAttachment (presign, PUT or POST form, confirm; stages and typed refusals), formatBytes,
                        scanChip and originLabel (desk and portal copy), the quarantine placeholders
components/admin/       AdminGate (fails closed), GrantsReconcile (whole-set save), PermissionChecklist (implied keys
                        ticked and greyed), AccountSettingsTab (AI section gated on ai:configure), IntakeTab (aliases with state
                        pills and the loop guard reason), contacts-tab (AccountContactsTab: the contacts with their flags as
                        checkboxes and the search sent as `q`), status pills, buttons
lib/admin/contacts      FLAG_LABELS and FLAG_MEANINGS, flagLabel and flagMeaning, flagsToOffer (the closed set plus any
                        flag a row already carries), toggleFlag (one box, the whole set back), contactFlagsBody,
                        contactLabel, flagsLine, contactsError and describeContactsError (stale_version, not_found)
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
components/admin/connectors/  pills (health, mode, map state, outcome, link state, outbound status on the signal trios), health-list,
                        add-servicenow-form, account-connectors-tab, instance-header (ModeSwitch, KillSwitchControl,
                        TestConnectionButton), settings-tab (SettingsForm, WatermarkPanel), map-lifecycle (useMapLifecycle:
                        select, draft, save, validate, activate), map-versions, field-map-editor, field-map-tab,
                        state-map-editor, state-map-tab, pairs-editor, runs-tab, dead-letters-tab, reason-dialog,
                        outbound-tab (OutboundTab, ConflictCell, statusFromSearch: the queue, the status filter written to the
                        URL and Retry per settled row)
components/admin/migration/  pills (batch, record, line, report status and dry run on the signal trios), batch-list,
                        new-batch-form, batch-summary (CountsStrip, RunProgress, BatchProperties, LogTab), records-tab
                        (RecordDrawer), reconciliation-tab (ReportPanel per report, signOffBlockedReason, Explain through
                        ReasonDialog with fieldLabel), migration-pages.test (the three pages: gating, URL filters, Run states)
lib/migration/          vocab (statuses, tones, RUNNING and RUNNABLE sets, runBlockedReason, object and source kinds, range
                        and source copy, formatDelta), errors (typed bad_range, no_active_field_map, batch_not_runnable,
                        report_signed, signer_ran_batch, delta_open, not_found by entity), filters (the list URL grammar)
components/admin/config/  account-config-tab (CatalogOverrides under admin:config, then RoutingRulesPanel), override-editor
                        (EffectiveSourcePill, BodyEditor keyed on the effective version id, VersionHistory), routing-rules
                        (RoutingRulesPanel gating the read on tickets:view, RoutingRulesEditor holding the whole set as one
                        draft and saving it with one PUT)
components/tickets/group-picker  the one way a screen names an assignment group (the Queue chip, the record, the routing
                        rules, a view's group share): the /v1/groups directory, a retired group offered only while it is
                        the value in force, and GroupName for a line of prose that has only the id
components/tickets/ticket-groups  the groups catalog (filters, DenseTable, GroupForm with the schedule, FreezeRows)
components/tickets/change-calendar  the month (RightNow from /v1/change-calendar/at, WindowCard per window with its
                        freezes and its changes, the next window)
lib/tickets/groups      the two things called a group kept apart, the ticket-group and routing drafts with their
                        validation in the API's own limits, the instant and local-datetime conversions, and the words for
                        every refusal the group routes answer with
lib/tickets/change-window  the four window refusals read out of the 409 (acknowledge versus override), their words, and
                        the calendar's month grammar (monthRange, shiftMonth, monthLabel, nextWindow, daysUntil)
components/time/bucket-log  Log time without a ticket: the account, the bucket, and the shared LogTimeForm opened on the
                        bucket's own billable class
components/time/buckets-panel  the account's buckets with the taxonomy, the class and its burn, and the edit under
                        contracts:manage
lib/admin/config-catalog  the six kinds, their scopes (state machine per ticket type), formatBody and parseBody
lib/admin/config-errors  typed invalid_config with the server's problems, unknown_config_kind, config_missing, not_found
components/tickets/sync-card  the rail's Sync card (external record link, link state, mode notice, the outbound state (last
                        pushed, what is waiting with the failed count, the last send error; kept where an instance dropped back
                        to ingest only, since the queue stays), the conflict note worded from the side that lost the contest
                        (inbound: ServiceNow changed a field XMS owns; outbound: the last push left those fields behind), last
                        runs)
lib/connectors/         vocab (XMS field table, tone maps, externalRecordUrl, bidirectionalBlocker: what the promotion still
                        needs, in the order the API checks it), outbound (OUTBOUND_STATUSES and their tones, the event labels,
                        isRetryable, the ConflictOutcome readers keptFields, droppedFields, dropReasonLabel and conflictSummary,
                        SyncCardOutbound and pendingLabel), errors (typed 409 and 400 bodies), use-connector-errors
lib/admin/              apiError/describeError (typed error bodies) and useMutationErrors (stale_version toasts + refetch)
app/(portal)/portal/    the client portal (P2.16.3) inside its own light chrome (never the internal shell):
                        / search-first home (own requests plus the knowledge placeholder), /sign-in (dev token paste,
                        Clerk SignIn when configured), /requests (Open or All, org-wide toggle with
                        portal:view-org-tickets), /requests/new (CP-03: the form the account published for the chosen type when there
                        is one, and the fixed default form otherwise, which is also what the page shows while the
                        forms route is not deployed; with a published form anywhere on the account the request types
                        are named by GET /v1/portal/forms rather than here, the chosen one is read again through
                        /v1/portal/forms/:type, and a type published for nothing still opens the fixed form with the
                        type already chosen above it rather than asked twice),
                        /requests/[key] (public thread, composer, Files card with upload and scan states, cancel, confirm closure,
                        reopen); /requests/new queues files and uploads them after the request exists;
                        /surveys (CP-07, functional 5.7: the pending surveys of both kinds as cards, each asking the
                        questions its own row carries, so a ticket-close survey shows one (named after the ticket) and a
                        quarterly one shows five, each a fieldset named by its own question with five buttons labelled very
                        dissatisfied to very satisfied; Send stays disabled until every question is answered and the body
                        follows the kind, `score` or the five keyed `scores`; the quarterly card is named by the quarter
                        ("2026 Q2 relationship survey") where there is no ticket to name; the completed ones read back the
                        score or each question and its answer; "No surveys pending."; already_answered and survey_closed
                        worded with the list read again) and /surveys/[id]
                        (with `#token=`, the email link: no chrome, no session. The page reads
                        POST /v1/csat/:id/describe with the token first and asks what that answers, so a ticket-close
                        survey opens on its one question named after the ticket and a quarterly one on its five, and
                        answers through POST /v1/csat/:id/answer with the same token. An unknown id and a token that
                        does not match answer the same 404, and the page says the same one thing back
                        ("This link is not valid."); an answered or expired survey reads as its status with no form
                        under it; with a session and no token the Surveys page with that survey first, or a notice
                        when it was already answered or is no longer open)
components/portal/      PortalChrome (account name and accent, nav with Surveys, user menu, 401 redirect; renders only the
                        main column when isSurveyLink matches, skipping /portal/me), SearchHome, RequestList,
                        survey-question (SurveyQuestion takes the row's questions: one fieldset each, named by its own
                        question, five labelled buttons, one comment, Send disabled until every question is answered),
                        RequestForm (validateRequest; it takes an optional type where the page has already asked for
                        one), dynamic-request-form (DynamicRequestForm: a published definition rendered by kind, the
                        conditional fields asked only once their condition holds, the required ones refused here first,
                        an attachment field pointing at the Files card, ci_picker and contact_picker as a typed
                        identifier since the portal serves no directory for either, posting { type, answers } and
                        wording each invalid_submission problem beside its own field and form_answers_required about
                        the whole form), RequestThread and CommentComposer, RequestDetail, primitives
                        (ClientStatusPill, PortalCard, buttons and inputs), attachments (PortalUploadControl, PortalAttachmentList,
                        client scan copy), surveys (SurveysPage with focusId, both kinds), survey-link (SurveyLinkAnswer,
                        which reads the survey behind the token before asking anything).
                        Renders portal view models only; nothing
                        from components/tickets or app/(internal) is imported here
lib/portal/             client-language (the seven client statuses, type and level copy, priority words, relative time),
                        forms (CP-03, the vocabulary both sides share, mirrored from the server's
                        src/domain/portal/form-schema.ts and never relaxing it: FORM_FIELD_KINDS, FORM_TICKET_TYPES,
                        FORM_TICKET_COLUMNS and COLUMNS_BY_KIND, CONDITIONABLE_KINDS and conditionValuesOf, LEVELS,
                        kindLabel, formTypeLabel and levelLabel; the client half conditionHolds, visibleFields,
                        answersBody (only what was asked and answered, each in its kind's shape) and missingRequired;
                        submissionError, problemsByField, describeSubmissionError and FORM_ANSWERS_REQUIRED_MESSAGE),
                        csat (SCORES, SCORE_LABELS, scoreLabel, surveyQuestion, isSurveyLink, expiryLabel; the two kinds:
                        surveyKind (a row with none reads as ticket_close), isQuarterly, periodLabel ("2026 Q2"), keyLabel,
                        questionsOf (what the server sent, never a question text kept here),
                        surveySubject, isAnswerable and statusLine, answerBody (`score` or the five keyed `scores`),
                        answerLine; LINK_NOT_VALID, surveyError and
                        describeSurveyError for already_answered, survey_closed with its status,
                        not_found, token_required)
test-kit/forms.ts       constructed request form fixtures (aFormField, aFormDefinition (a required summary, a choice a
                        later field reads, the conditional text behind it and a boolean), aFormVersion, aPublishedVersion,
                        aTicketForm (version 1 published with version 2 waiting as a draft), aPortalForm and
                        aDefaultPortalForm) with FORM_ACCOUNT_ID, FORM_ID, DRAFT_VERSION_ID and PUBLISHED_VERSION_ID
test-kit/time.ts, tickets.ts, roster.ts, connectors.ts, capacity.ts, migration.ts, calendars.ts, knowledge.ts and
                        config.ts   the builders that used to live in the redux slice tests and were imported across
                        files, which re-registered those files' suites in every importer; each module declares no suite
test-kit/shared-fixtures.test.ts  the scan that keeps it that way: no test file imports another, no source file
                        imports a test file, and no imported test-kit module declares a describe, an it or a test
test-kit/portal.tsx     constructed portal fixtures (aPortalMe, aPortalTicket, aTimeline, aSurvey, anAnsweredSurvey,
                        QUARTERLY_QUESTIONS, aQuarterlySurvey, aQuarterlyAnswer, aSurveyDescription and
                        aQuarterlyDescription as the describe route answers them), the fetch stub and renderPortal for the
                        portal tests
test-kit/reporting.ts   dashboard, audit and report fixtures, plus aCsatSummary, aCsatQuarterly, aSchedule, aRun,
                        aDelivery, aHeldPack and aReviewRun (a run held inside its grace period, with both presigned
                        links, a templated narrative and nothing delivered), aNarrativeEdit, anEditedReviewRun (the same
                        run with a reviewer's words waiting to be regenerated) and aRegeneratedRun,
                        SCHEDULE_ID, INTERNAL_USER_ID, REVIEW_RUN_ID and HELD_PACK_ID; the Security dashboard fixture
                        carries the row shapes the API answers today, with PAUSED_INSTANCE_ID, PAUSED_SUBSCRIPTION_ID
                        and SECURITY_ACCOUNT_ID; aSavedQuery and aSavedQueryPage with SAVED_QUERY_ID and
                        QUERY_OWNER_ID; anIntegrityPanel (one stream verified and one never verified, an archive of the
                        security stream alone, and the retention policy with the detach job still unbuilt); aFunnel
                        (whose solution_linked step deliberately gains, so its drop-off is negative) and anAdoption
                        (with the unassigned row the API reports for an actor holding no role)
test-kit/views.ts       constructed saved-view fixtures (aSavedView, aSavedViewDefinition) with SAVED_VIEW_ID,
                        VIEW_OWNER_ID and VIEW_ACCOUNT_ID; the definition is the one the Queue itself would write
test-kit/integrations.ts  constructed API client and finance fixtures (anApiClient, aScope, someScopes, aDestination,
                        aFinanceDelivery) with the ids API_CLIENT_ID, FINANCE_ACCOUNT_ID, OTHER_ACCOUNT_ID and
                        BILLING_PERIOD_ID; no live key, endpoint or account
test-kit/desk.tsx       renderDesk (store plus toasts) for desk component tests, re-exporting the fetch stub
test-kit/my-work.ts     constructed My work fixtures (aWaitingItem, aWaiting written the way the API writes it today,
                        aPlatformWaiting in the older platform URL space, WAITING_ACCOUNT_ID)
components/my-work/     waiting-rail (WaitingRail over GET /v1/me/waiting: a row per item with a non-zero count linking to
                        the address lib/my-work/waiting-links resolves for it; "Nothing is waiting on you" when none is;
                        hidden entirely, with no error, while the route answers 404 or 501, so My work keeps working
                        before the backend deploys; waitingRows and isNotDeployed)
lib/my-work/waiting-links  serverHref, WAITING_TARGETS (the item key to a lib/routes screen id and its search) and
                        waitingHref. The API now writes this application's own addresses, two of which name an account
                        no key could express (the report-review row's Report packs tab, the low-score row's Satisfaction
                        tab), so the link comes first and is checked rather than trusted: same-site, matched through
                        matchScreen, and a screen this viewer may open. Anything else falls back to the key's target,
                        which is how an older API's /queue and /timesheet and a viewer without admin:accounts both still
                        land somewhere real; a key mapped to no screen (notifications live in the shell's bell) and a
                        screen the viewer may not open both read as text, and only a key the registry has never heard of
                        falls back to the server's link through lib/safe-url alone. The report-review row keeps the
                        Report packs tab, which lists every waiting run and links each one on to /reports/runs/[id];
                        an API that names the run itself needs no change, since that address is a registered screen and
                        serverHref accepts it for a reader holding reports:manage
components/shell/       FinderBar, FinderOverlay, PinnedSidebar, ContentHeaderBar (HeaderFilters, HeaderAction portals),
                        CommandPalette, NotificationsMenu (bell dropdown, 60 s unread poll; the row's link is written by
                        the API, so it goes through lib/safe-url before it reaches a navigation and a row whose link is
                        not an ordinary address opens nothing), Shell, ScreenStub
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
redux/                  api.ts (base API, me endpoint, waitingOnMe over /v1/me/waiting on the Waiting tag, the item's
                        link optional as the API sends it), adminApi.ts (Accounts & Administration endpoints and types, plus
                        getAccountConfig (effective may be null when nothing is active), setAccountOverride and
                        removeAccountOverride on the AccountConfig tag; CONTACT_FLAGS with listContacts (`q`) and
                        setContactFlags (the whole set with the version, the list reloaded either way) on the Contacts tag;
                        the six request form routes listTicketForms, createTicketForm, patchTicketForm, addFormVersion,
                        editFormVersion and publishFormVersion on the TicketForms tag, every write reloading the list,
                        since the list carries every version of every form),
                        migrationApi.ts (batches with filters and run_by_name, create, one batch with its report, run, records
                        with status and search, one record with its payload, reconciliation reports with signed_by_name,
                        explained_by_name, can_sign and sign_blocker, explain, sign-off; tags MigrationBatches,
                        MigrationBatch, MigrationRecords, Reconciliation),
                        ticketsApi.ts (tickets carrying the scope block, flagTicketScope under tickets:work and
                        decideTicketScope under tickets:approve-scope (each reloading the ticket, its timeline and the
                        waiting rail, the decision also the Budget tag since an allowance changes it),
                        transitions with optimistic list and record patches, messages, timeline,
                        links, watchers, notifications, directory lookups, account contracts with after_hours_handling,
                        after_hours_multiplier and the budget rules (threshold_percents, threshold_notify_client, overage_rule,
                        overage_multiplier, rollover_rule, rollover_cap_hours, forecast_window_days) and technology_codes,
                        patchContract with the version over the whole rule set (engagement_id included), invalidating
                        SkillsMatrix; listEngagements, createEngagement and patchEngagement on the account's
                        `:engagements` tag, the list reloaded even when a patch is refused; listSavedViews,
                        createSavedView, patchSavedView and deleteSavedView over /v1/views on the SavedViews tag, the
                        list reloaded even when an edit is refused), portalApi.ts (the
                        /v1/portal mirror, portalForms and portalForm on the PortalForms tag (the request types the
                        account offers and the definition behind each, the fixed default among them where it published
                        none), CreatePortalTicketBody taking `answers` beside the flat shape, the searchArticles
                        placeholder, portalSurveys with pending and answered, each
                        row carrying its kind, period, questions and answers, one AnswerSurveyBody taking `score` or
                        `scores`, answerPortalSurvey reloading the list even when refused, describeSurveyLink (a POST
                        that reads, because the token belongs in the body and never in the address) and answerSurveyLink
                        posting the token to /v1/csat/:id/answer on the PortalSurveys tag),
                        reportingApi.ts also accountCsat with from and to, its optional quarterly block, on
                        the Csat tag, securityIntegrity on the Dashboards tag (its own route, since it reads the
                        present rather than the window the dashboard counts), auditSavedQueries,
                        createAuditSavedQuery, patchAuditSavedQuery and deleteAuditSavedQuery on the
                        AuditSavedQueries tag with runAuditSavedQuery as a mutation (a POST fired on a click and
                        paged by hand, not a cache entry keyed on a query), the usage answer carrying the optional
                        funnel and adoption blocks, reportSchedules by account, createReportSchedule, patchReportSchedule with the version
                        (reloading the list either way), runScheduleNow with the optional period (reloading schedules, runs
                        and the account's Reports), scheduleRuns by account, status and schedule on the ReportSchedules
                        and ReportRuns tags, and the five review routes reviewRun (which also carries the narrative, its
                        source, its version, whether it is rendered and whether AI is on for the account),
                        editRunNarrative, regenerateReportRun, approveReportRun and cancelReportRun (each write
                        reloading the run, the account's runs, its Reports card and the Waiting rail whether the
                        API took it or refused it, since a refusal means this view is behind the run); reportPack takes
                        { id, format } so the PDF is its own cache entry and never overwrites the deck's download,
                        apiClientsApi.ts (apiClients, apiClientScopes, createApiClient (the key
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
                        listOutbound with its status and retryOutbound on the ConnectorOutbound tag (a retry also reloads the
                        runs and the instance), ticket sync with the outbound half per link; useConnectorInstance selects the
                        record out of the health list),
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
