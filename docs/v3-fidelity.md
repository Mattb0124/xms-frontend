# The v3 fidelity pass

What changed, screen by screen, against `01-architecture/wireframes/v3/` and
`01-architecture/WIREFRAMES.md` sections 2, 4 and 8, and what still differs.

Screenshots are outside git, in `C:/Users/matt.brown/Documents/repos/xms-work/shots-v3/`
for pass one and `.../shots-v3-pass2/` for pass two, at the prototype's own
1500 by 1020. Before shots are the stack as the reviewer was running it; after
shots are this branch on a dev server of its own.

## Hand-off reconciliation (pass two)

Pass one measured the renders off the PNGs because the prototype file
(`XMS-v3-standalone.html`) is a bundler page with a base64 payload rather than
readable markup. Two things changed that for pass two:

1. **The payload unpacks.** The `__bundler/template` script in that file is a
   JSON string holding the whole rendered page with its inline styles, and the
   `__bundler/manifest` script holds the gzipped assets. Unpacking it gives the
   prototype's own literals, not a pixel estimate: it is the source every
   measurement below is now taken from.
2. **The design hand-off arrived**
   (`01-architecture/wireframes/v3/handoff/`): `XMS-UI-SPEC.md` and
   `xms-ui.css`, which the spec names as the source of truth for the build.
   Where the hand-off and pass one's measurement disagree, the hand-off wins.

What changed as a result, value by value:

| Token or rule                             | Pass one                                        | Now                                                                                        | Source                                                            |
| ----------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `--xms-bar` (the grey tool strip)         | `#F0F3FA`                                       | `#E7E9ED`                                                                                  | `xms-ui.css` `--xms-toolstrip`; the render's own pixels agree     |
| The strip's rule                          | `--xms-line` `#E4E8F5`                          | `--xms-bar-line` `#CFD5DF`                                                                 | `--xms-toolstrip-edge`                                            |
| The page canvas                           | not painted, so the body's white showed through | `--xms-bg` `#F4F5F7` on the scrolling column                                               | `.xms-main { background: var(--xms-canvas) }`                     |
| Row divider                               | `--xms-line` `#E4E8F5`                          | `--xms-line-row` `#EEF1F6`                                                                 | `.xms-table td`                                                   |
| Table header underline                    | `--xms-line` `#E4E8F5`                          | `--xms-line-head` `#D5DBE5`                                                                | `.xms-table th`                                                   |
| Row hover                                 | `--xms-row-hover` `#F7F8FA`                     | `#F0F3FA`                                                                                  | `.xms-table tbody tr:hover`, hand-off section 7                   |
| Toolbar control edge                      | `--xms-line` `#E4E8F5`                          | `--xms-control-line` `#C3CAD6`                                                             | `--xms-line-control`                                              |
| Dashed "Add filter" edge, idle sort glyph | `--xms-line-strong` / `--xms-muted`             | `--xms-quiet-line` `#B4BDCC`                                                               | `.xms-chip.is-add`, hand-off section 5                            |
| Toolbar pill radius                       | `999px`                                         | `4px` (`--xms-radius-control`)                                                             | `--xms-r-ctl`; 999px is for state, priority and count pills alone |
| Sort glyph                                | a paired caret at 12px, 2.2px stroke            | Lucide `chevrons-up-down` at 13px, 1.5px stroke, swapping to `arrow-up` in the link colour | hand-off section 5                                                |
| Table cell padding                        | `12px` both ways                                | 13px vertical, 14px horizontal                                                             | `--xms-row-y` / `--xms-row-x`                                     |
| Content width                             | unbounded                                       | `max-width: 1200px`, 20px gutter, 18px above and 40px below                                | `--xms-content-max`, `.xms-main > .in`                            |
| Mono count fill                           | `--xms-tint` (blue)                             | `--xms-chip` `#F0F3FA`                                                                     | `.xms-nav-badge`                                                  |

The icons stay in `components/xms/icons.tsx` rather than moving to
`lucide-react`. The hand-off asks for Lucide geometry at 1.5px stroke on a
24px canvas and warns against `lucide.createIcons()` inside a React tree; the
inline set already is that geometry, and the two glyphs the sort control
needed were drawn from Lucide's own paths, so no package was added for two
`<path>` elements.

## How the measurements were taken

Band geometry was read off the pixels rather than eyeballed, by walking a
column down each PNG and recording where the colour changes. The renders carry
the prototype's own page chrome, a 20px margin and a 60px title strip, so every
render coordinate below is quoted in the render's own space and the app
coordinate in the app's.

| Band                        | Render                                                 | App, after                                |
| --------------------------- | ------------------------------------------------------ | ----------------------------------------- |
| Navy finder bar             | y 60 to 115, so 56px                                   | y 0 to 55, so 56px                        |
| Toolbar band, rule included | y 116 to 167, so 52px                                  | y 56 to 107, so 52px                      |
| Toolbar pills               | y 126 to 157, so 32px, 10px above and below            | y 66 to 97, so 32px, 10px above and below |
| Gap between pills           | 8px                                                    | 8px                                       |
| Sidebar                     | 238px                                                  | 238px                                     |
| Page padding                | 20px, card left edge x 278 with the sidebar ending 258 | 20px                                      |

## The whole-product changes

These land on every screen, including the roughly 33 screens with no render at
all, which is what keeps them reading as one product.

- **The shell.** Finder bar, sidebar, toolbar and overlay, below.
- **One focus treatment.** The vendored `aiinnovation-tokens.css` sets a global
  `:focus-visible` outline with a 2px offset, and nine components were adding a
  Tailwind ring over it, which is the doubled border the user saw. The vendored
  file is untouched. `styles/tokens/xms-scope.css` now states the treatment
  once, a 2px cobalt outline on the control's own radius with no offset, and
  every `focus-visible:ring-*`, `focus-visible:outline-*`, `focus:border-*` and
  `focus-within:border-*` class was removed with it.
  `components/xms/surfaces.test.tsx` scans `components/` and fails if one comes
  back.
- **The fonts were not loading.** `next/font/google` fetches at build time and
  falls back to the bare family name when it cannot. The computed body font in
  the running app was `Inter, sans-serif` with no generated fallback face, so
  every screen was drawn in the platform sans; IBM Plex Mono, whose fetch had
  succeeded, was real. Both are self-hosted now from `public/fonts` through
  `styles/tokens/fonts.css`, verified with `document.fonts.check`.
- **The page padding** is 20px, from the shell, and the primary blocks on the
  Queue, My work and the ticket record sit 20px apart.
- **No tile strip where the render has none.** The Queue's four KPI cards are
  gone. My work (08) and Operations (10) keep theirs, because both renders have
  them.
- **The development indicator is off** (`devIndicators: false`): it is a fixed
  circle in the bottom left, exactly over the sidebar's own footer control.

## 1. Shell

`before-tickets.png` / `after-tickets.png` (the bar is the top 56px of both).

Changed:

- The bar was rendering at about 32px. It carried `height: 56px` but, as a flex
  child of a column, was being squeezed; it is `shrink-0` now. The toolbar had
  the same bug.
- The real logo replaced the drawn four-square mark and the text wordmark:
  `public/thehackettgroup_logo.svg`, 196 by 24, white paths, rendered at its
  native size and linking home. It carries the words itself, so there is no
  second wordmark.
- Finders at 14px medium; scope pill a fixed 320px rounded pill with the
  instance, the view, a chevron onto the Favourites overlay and the star;
  search a white rounded field with a magnifier and the "/" hint; Axel a pill
  with its sparkle; a bell with a red count badge; a round avatar.
- **No layout shift.** Every zone in the bar is a fixed width and the badge is
  absolutely positioned on the bell, so `me`, the unread count and the screen
  label arriving move nothing. The sidebar's count column is a reserved 18px
  for the same reason.
- Sidebar: an icon per screen, counts right-aligned, the starred views section,
  and a footer naming the tree count beside "Browse all screens". Counts come
  from the routes the screens read (`stats.open`, `stats.unassigned`, the
  held-email list), each skipped unless the reader holds that screen's
  permission. The selected row is the render's tinted fill, cobalt left bar and
  500 ink.
- Toolbar: line icons for the hamburger, funnel and gear; the title as text
  with a chevron over a transparent select rather than a native dropdown; a
  search slot; the band at the measured 52px.

Still differs:

- The scope pill reads "THG PROD · Queue" where the render reads
  "THG PROD — Queue: my group, open". The separator is a middot because the
  house rule bans em-dashes in copy, and the view qualifier is the current
  screen label, since nothing on the API names the scope as a sentence yet.
- The sidebar shows Solutions and not My timesheet, and the starred views
  section is empty: both are the route registry and this browser's stars, not
  layout.
- Quarantine reads 0 and Queue 26 against the render's 3 and 42. Seed data.

## 1b. The Queue, as the reviewer asked for it (pass two)

Four asks, all on the Queue and all of them overriding what render 01 draws:

- **The count is gone, twice.** The card header carried the word "Count" and a
  badge repeating the row count, and the breadcrumb row carried "26 open
  tickets" beside Save as view. Both are gone, and with them `DenseTable`'s
  `count` prop (26 call sites) and `BreadcrumbTrail`'s. The sidebar keeps its
  badges, which is where the hand-off puts the number.
- **The sort glyph.** 13px `chevrons-up-down` in `--xms-quiet-line`, swapping
  to `arrow-up` in the link colour on the sorted column, per hand-off section 5. It was a 12px paired caret at a 2.2px stroke, which read as a smudge.
- **Opened.** A new column between State and Assignee carrying the instant the
  request arrived, in mono, as "25 Aug" and "31 Dec 25" once the year differs,
  sorted on the ISO instant rather than on the words. "Updated" answers a
  different question and could not stand in for it.
- **No colour on Account or Type.** The identity square before the account
  name and the 3px bar before the type label are off the Queue: the row now
  carries colour for state, priority and the clock alone. `AccountDot` and
  `TypeBar` are unchanged and still drawn on My work's Needs attention list
  (render 08 has them there) and on Dispatch, through the new
  `accountIdentity` column option.

## 1c. The filter row and the builder the funnel opens

The reviewer sent a reference for the filter row
(`01-architecture/wireframes/v3/refs/filter-builder.png`, copied here as
`docs/images/filter-builder-reference.png`). **It wins over render 01 for
this row**: the render draws pills with a caret and a cross, the reference
draws real select controls, and the conditions the pills could not express
live in a builder the funnel opens rather than behind "+ Add filter".

The reference:

![The reviewer's reference](./images/filter-builder-reference.png)

The built screen, funnel open with two conditions set
(`/tickets?c=[["short_description","contains","report"],["priority","eq","p1"]]`):

![The filter builder as built](./images/filter-builder-built.png)

What that took:

- **The strip's dimensions are selects.** `FilterSelect` is a native `select`
  on the strip's own 32px, 4px, 13px control geometry, reading "Account: all"
  until it carries a value; setting it back to all is what removes the
  criterion, so there is no cross to find. The primary dimension carries the
  count in brackets, as the reference's "Show: Active (7)" does, and the
  Queue's system views and the server's saved views share the one control.
  The widths are capped at 150px: "State: awaiting third party" was setting
  the State control to 195px and pushing Type off the end of the strip.
- **The builder stands on the grey under the strip.** `ContentHeaderBar`
  grew a panel slot and a `HeaderFilterPanel`; a screen that registers one
  gets the funnel, and the funnel carries a badge with the number of
  conditions standing behind it. The card header's own funnel drives the same
  panel through `useHeaderFilterPanel`, so the reader is never asked which
  filter was meant.
- **One condition grammar, and it is the server's.** `lib/conditions.ts` used
  to declare operators the API does not have ("is", "is_not", "gt", "lt",
  "empty"), so a condition built with it could never have been sent. It is
  now the server's own vocabulary (`src/modules/tickets/conditions.ts`), with
  the same operator-per-kind map, and `lib/tickets/queue-conditions.ts`
  declares the offered fields out of the server's allowlist, filling Account
  and Group from the catalogs so neither asks for a uuid.
- **The URL is still the state.** Conditions travel in `c=` as readable JSON
  and reach `GET /v1/tickets` as the base64url set the route already decodes,
  which the desk had never sent. A row still being filled in stays in the URL
  and is left out of the request. The breadcrumb restates every condition in
  words and each segment removes its own, and Save as view folds the built set
  into the definition beside the chips.

Still differs: the reference shows three dimensions on the strip and the Queue
carries four (Account, State, Priority, Type), which is render 01's set; and
the reference's condition row is one line wide where the built one is capped
at 760px so the value box does not run the width of a 1460px desk.

## 2. Queue (render 01)

`before-tickets.png` / `after-tickets.png`, overlay `diff-01-queue.png`.

Changed: the KPI strip removed; the Show dimension a real dropdown wearing the
blue outline pill; the four standing dimensions (Account, State, Priority,
Type) always drawn, reading "all" until chosen and growing a clear mark once
carrying a criterion, each a real menu over the same chip grammar so the URL is
still the state; the condition trail, the count and Save as view on one line
instead of three rows; the card carrying Count, the centred search and the
funnel and column controls; the table ending at Assignee so it fits 1500 with
no horizontal scroll, with SLA and Updated kept as hidden columns behind the
column control so the list still opens on the tightest clock; Assignee as
"M. Brown" with no avatar circle; P2 no longer lighting up amber; the selection
bar carrying the render's Assign, Change state, Add tag and Export.

Still differs:

- Add tag is drawn disabled: nothing on the API takes a tag. Assign and Change
  state loop the per-ticket routes, because `POST /v1/tickets/bulk` does not
  exist yet; when it does they become one call and the bar does not change
  shape.
- The chips read the URL, so on a first visit all four say "all" where the
  render shows "State: open". The render is showing a saved view.

## 3. Ticket record (renders 02 to 07)

`before-tickets-CS1000016.png` / `after-tickets-CS1000016.png`, overlay
`diff-02-ticket-conversation.png`.

Changed: the key in mono beside the title as text, not a bordered input, still
editable on click; the "← Queue" link dropped (it is in the more menu); the
pill row state, priority and clock at 32px with the chevron inside the state
pill; Ask Axel and a more menu on the right, Ask Axel opening the shell's Axel
panel through the address; Properties a flush card with an ALL-CAPS caption
over a hairline-ruled label-above-value list with no bordered boxes at rest;
the tabs as the card header with no "Work area" title; Sync promoted from a
rail card to its own tab; the composer saying Public reply with Draft with Axel
and Template beside it; Activity gaining the actor filter pills.

Still differs:

- Draft with Axel and Template are disabled with the reason on them: the Axel
  turn surface is held and there is no template catalog on the API.
- Email is a seventh tab after the render's six. The built record has an email
  surface the prototype does not carry, and dropping the tab would drop it.
- The rail carries Scope, Attachments, Solutions, Contract, Requester and
  Watching where the render carries Service levels, Contract and Similar
  solutions. Those extra cards are built behaviour, not drift.
- The Axel panel body is held, as briefed: the frame matches render 15 and the
  body says the suggestions and tool calls appear there.

## 4. My work (08), Dispatch (09), Operations (10), Quarantine (11)

`before-my-work.png` / `after-home.png`, overlay `diff-08-mywork.png`;
`before-tickets-dispatch.png` / `after-tickets-dispatch.png`, overlay
`diff-09-dispatch.png`; `before-dashboard.png` / `after-operations.png`,
overlay `diff-10-dashboard.png`; `before-tickets-quarantine.png` /
`after-tickets-quarantine.png`.

Changed: the scorecards keep their place, gain the render's caption beside the
number and the render's 26px on a shared baseline; My work takes the render's
two columns with Time today and Waiting on me in a 320px rail; Needs attention
takes a lean five-column set; Time today stacks rather than folding into four
wrapping columns in the rail; the Axel brief takes the sparkle and a worded
Dismiss; the Dispatch card reads key, title, account and age, then the pickers,
the suggestion and the two actions, which is the render's two rows for what the
built card said in three.

Still differs:

- Quarantine is left alone: render 11 is a "not restyled yet" placeholder, so
  the built screen is ahead of it and takes only the shared chrome.
- Operations keeps its six tiles and four panels; the render's synthesis line
  and the panel set already match.
- The Dispatch group and assignee pickers keep native select chrome where the
  render draws its own chevron.

## 5. The overlays (12 to 14) and the Axel panel (15)

Changed: the All overlay takes the render's anchor under the finders, its
640px width, its lighter navy ground, a filter field with a magnifier, a drawn
pin glyph in place of the emoji, and count badges on the rows. The Axel panel
frame is built to render 15, docked right at 340px, pushing the content rather
than overlaying it, with the sparkle header, the ask field and the standing
footer rule.

Still differs: the All overlay keeps each screen's purpose line beside its
label, which the render does not draw; it is useful and additive. The Axel
panel body is held.

## 6. Screens with no render, grammar applied

Fifteen renders exist against roughly forty-eight registered screens. Every
screen with no render takes the same grammar through the shared components
rather than through a copy: the shell (finder bar, sidebar, toolbar band, page
padding), the card (`xms-card`, `Panel`, `RailCard`), the table (`DenseTable`,
no striping, hairline rows, mono keys, the paired sort caret), the pills
(`StatePill` on the v3 ramp, `PriorityPill`, `TypeBar`, `AccountDot`,
`FilterSelect`, `FilterChip`), the forms (`RecordForm`, both layouts) and the
single focus treatment. They are: Groups, Change calendar, New ticket,
Solutions and the knowledge screens, My timesheet and Team time, Billing
periods, Accounts and the account record tabs, Contracts, Roster, Capacity,
Allocation grid, Skills matrix, Demand, Reports and report runs, Audit,
Security, and the admin console and its tabs, plus the portal, which is
client-branded and deliberately not on this system.

## 7. The overlay diffs, and why the percentage is not the score

`diff-*.png` in the shots directory are `pixelmatch` overlays of the after
screenshot against the render, cropped to the app frame (x 20, y 60, 1460 wide,
660 tall, which is the band every render shares above its notes panel).

| Screen           | Differing pixels |
| ---------------- | ---------------- |
| 01 Queue         | 7.4%             |
| 02 Ticket record | 7.4%             |
| 08 My work       | 9.7%             |
| 09 Dispatch      | 7.1%             |
| 10 Operations    | 14.9%            |

The residual is almost entirely **data**, not layout: the local stack is seeded
with different accounts (Brookfield and Austral Mining against the render's
Brookfield UK, Kestrel Retail, Northwind Group and Aldergate Energy), different
keys (CS1000008 against CS0001203), different counts, and states the seed does
not produce. Render 01 also shows three rows selected and its selection bar
open, which the app cannot show without a click, and render 08's numbers are
non-zero where the seeded reader has nothing assigned. Every band that can be
measured independently of the data is measured in the table at the top of this
document and matches.

Reading the overlay rather than the number: the sidebar rows, the toolbar band,
the table header row and the card edges all land on the render's own lines. The
text inside them is different text.

## 8. Known gaps

- No `POST /v1/tickets/bulk`, so Assign and Change state loop; no tag route, so
  Add tag is disabled.
- No Axel turn surface, so Draft with Axel, Template and the Axel panel body
  are held.
- The scope pill cannot say "my group, open" until something names the scope.
- The prototype source (`XMS-v3-standalone.html`) is a base64 bundle rather
  than readable markup, so every measurement here comes from the rendered PNGs
  and from WIREFRAMES sections 4 and 8, not from the prototype's CSS.
