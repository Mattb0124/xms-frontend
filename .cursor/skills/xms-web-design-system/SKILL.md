---
name: 'xms-web-design-system'
description: 'Build and maintain XMS Web UI with the XMS design system as fixed by the v2 wireframes: the three token layers in frontend/styles/tokens, the .xms-scope identity tokens (navy finder bar, blue actions, no row striping, IBM Plex Mono for keys and SLA values, violet for AI-origin content only), the never-re-themed state trios, and the ServiceNow-shaped screen grammar. Use when creating any UI in frontend, styling a component or page, picking a colour, building a dense list, record form, record view, eyebrow header or ink banner, or fixing styling that does not flip in dark mode. Answers which token to use; the companion skill no-hardcoded-styling answers where the style is allowed to live.'
---

# Skill: XMS Web Design System

XMS Web looks like the XMS proof of concept: the AI Innovation (aiinds) token system underneath, the **Ink and Cobalt** solution identity on top, ServiceNow-shaped screens. Authority for everything here is `01-architecture/DESIGN-SYSTEM.md` and, for the five built screens and the shell, `01-architecture/WIREFRAMES.md` (the v2 prototype, ADR-17); when this skill and those documents disagree, the documents win. Rendered references live in `01-architecture/wireframes/`.

The whole product renders inside `.xms-scope`, so every `--xms-*` token is available in every component.

## The three layers (all in `frontend/styles/tokens`)

The tokens were seeded once from AIX and are now owned by XMS. There is no shared package, because the repositories are separate (ADR-12).

| File | Holds | Editable |
|---|---|---|
| `aiinnovation-tokens.css` | The vendored `--aiinds-*` primitives | **Never.** A resync would clobber it. Override in a layer above |
| `house.css` | The `--aix-*` aliases, the `--state-*` signal trios, `.aix-state-pill`, the dark flips | Rarely, and only for house-wide changes |
| `xms-scope.css` | `.xms-scope`, the `--xms-*` identity tokens, `.xms-card-shell`, `.xms-section`, `.xms-eyebrow`, `.xms-banner`, `.xms-pill`, the control geometry block | **Yes.** This is where new XMS styling goes |
| `tailwind-preset.js` | The `xms.*` and `aiinds.*` Tailwind namespaces, `darkMode: ["class"]` | Yes, when a token needs a utility |

The `--aix-*` names in `house.css` are not drift and must not be renamed: they are the carried-over house alias layer. `--xms-*` is the solution identity on top of them.

## Identity tokens (`.xms-scope`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--xms-ink` | `#0F1623` | `#eaf0f8` | Headings, ticket keys, scorecard numbers |
| `--xms-body` | `#3D4A5C` | `#d5dce8` | Body text and table cells |
| `--xms-label` | `#5A6784` | `#a9b4c6` | Field labels, section captions |
| `--xms-muted` | `#7B8CA0` | `#8a97ad` | Meta, timestamps, placeholders; never essential copy |
| `--xms-accent` | `#2563EB`, hover `#1D4ED8` | `#7ea0ff` | Actions, links, active pill outline, selected item bar, focus. **Never large fills except the primary button** |
| `--xms-navy` | `#10193A` | `#0b1226` | The finder bar and the finder overlay only |
| `--xms-line` | `#E4E8F5`, strong `#C9D2E6` | `#243349` | Borders, dividers, table hairlines |
| `--xms-bg` | `#F4F5F7` | `#0c1626` | Page canvas |
| `--xms-bar` | `#F0F3FA` | `#121b2e` | Content header bar |
| `--xms-card` | `#FFFFFF` | `#141f31` | Cards, tables, rail cards |
| `--xms-tint` | `#EFF4FF` | `#1a2740` | Selected row, active pill fill, state pill background |
| `--xms-ai-bg`, `--xms-ai-border`, `--xms-ai-accent` | `#EDF1FF`, `#C7D6F7`, `#7C9AE8` | tinted | AI-origin content only: summaries, suggestions, drafts, the synthesis line. **Never status** |
| `--xms-row-hover`, `--xms-cell-hover` | `#F7F8FA`, `#EFF4FF` | tinted | Dense list hover. There is no zebra token |
| `--xms-mono` | IBM Plex Mono | same | Keys, SLA values, counts, tool calls, 11px uppercase labels with `.06em` tracking |
| `--xms-state-<state>-fg/-bg/-br` | New slate, In progress blue, Awaiting client amber, Awaiting approval teal, Resolved green, Closed grey (values in Wireframes §8.1) | tinted | Ticket state pills only |
| `--xms-type-incident/-request/-change/-problem` | `#DC2626`, `#0E7490`, `#7A5AF8`, `#B45309` | same | The 3px type bar beside the type label only |
| `--xms-account-1` to `-6` | blue, teal, amber, green, violet, magenta (Wireframes §8.3) | same | The 8px identity dot before an account name; assigned per account at creation |

**Text has four levels and nothing else:** ink for headings and keys, body for copy and cells, label for field captions, muted for meta and placeholders. Essential copy is never muted. `text-gray-*` and `text-slate-*` do not belong in this product; use the tokens.

## Signal tokens (never re-themed)

SLA, priority and scan-state colours use the shared `--state-*` trios through `stateTrio(name)` in `vocab.ts`: `needs-input` (amber), `ready`, `blocked`, `progress`, `complete`, `stale`, `overdue` (red). Ticket **states** use the v3 state ramp (`--xms-state-*`) instead; a state colour is never a clock colour and the two never share a cell.

Two rules that are easy to get wrong:

- **A breached clock is red because red means breached everywhere.** The identity accent never colours a signal.
- **P1 and P2 light up; P3 and P4 stay quiet**, so the priority column reads by exception. Do not give every priority a colour.

## Per-account branding

The account's logo and accent apply to **the portal header band and the email header only**. The working UI never changes colour per account, so a consultant moving between accounts sees one consistent product. Do not thread an account accent into internal chrome.

## Screen grammar (ServiceNow-shaped)

| Pattern | Rule |
|---|---|
| Dense list | Card with a Count badge and in-card search, sticky header, **no row striping** (hairline `--xms-line` between rows plus `--xms-row-hover`), 32 to 34px controls, 4px radii on controls and 6px on cards, the content header bar above with filter pills (the first is the blue-outlined "Show:" dimension), gear, local search and the primary New |
| Condition builder | Field, operator, value rows stacked with AND; a breadcrumb filter trail where clicking a segment removes that criterion; saved as a view |
| Full-screen record form for New | Slim topbar (back, "Ticket · New record", Cancel, Submit), two-column label-left grid with red asterisks, full-width short description and description, searchable roster combobox for assignee |
| Record view | Thin record bar, editable properties that commit on change or blur, tabbed work area (Conversation, Activity, Resolution), slim related-info rail |
| Admin | Same list plus record grammar as everything else. No bespoke admin chrome |
| Navigation | Navy finder bar (All, Favourites, History, centre workspace pill with star, global search, Axel, bell, avatar) plus a pinned sidebar with starred views and "Browse all screens"; the 27-screen tree lives in the All overlay with pin toggles. The content header bar carries the hamburger and the screen switcher |
| AI surfaces | Summary blocks, suggestion cards, the synthesis line and Axel chips use the `--xms-ai-*` family; the docked Axel panel pushes the content and shows suggestion cards with Accept and Reject, tool-call rows in mono, and withheld notices |
| Skeleton | Mirrors the anatomy, initial load only. Refetches keep rendered data |
| Page header | ALL-CAPS accent eyebrow, ink title, one-line subtitle |
| Ink banner | Lead phrase in accent-light, remainder in banner foreground |

XMS dense lists have no row striping (the v2 wireframes overrode the POC's zebra); rows separate on a hairline and a hover fill.

Copy rules: **no em-dashes anywhere** (house rule, and it overrides the theme voice guide), middots in tags, arrows allowed in flow statements, ServiceNow vocabulary where it aids adoption (CS keys, work notes, resolution codes, "New record").

## Components

- shadcn primitives are **regenerated with the shadcn CLI in XMS**, not copied from AIX, so versions are XMS-owned: `button`, `dialog`, `select`, `popover`, `command`, `table`, `sheet`, `tabs`, `tooltip`, `form`, `toast`, `skeleton`, `resizable`, `scroll-area`. For a new shared primitive use `xms-web-ui-component`.
- House composition components are `SortableTable`, `Panel`, `TabBar` and `ScoreCard`. For tables use `xms-web-data-table`.
- Icons: `lucide-react` at 1.5 stroke. Fonts are wired through `next/font/google`: **Inter** for UI and **IBM Plex Mono** (`--xms-mono`) for keys, SLA values, counts, tool calls and uppercase labels. No third face.
- Dark mode: `next-themes` with `attribute="class"`; both `.dark` and `[data-theme="dark"]` are targeted. The portal defaults to light.

## Known gotchas (all verified in the source, do not "fix" them)

- `var()` breaks Tailwind opacity modifiers, so a few colours are raw hex **in the token files**. That is not licence to hardcode in a component.
- Moving Noto Color Emoji earlier in the font stack turns numerals into keycap emoji. It stays after the text fonts.
- `.dark` must be declared after the light `:root` or native controls stay light.
- The AIX `web-ui/styles/globals.css` was a stale second copy and is not a source for anything.

## Not carried over

The AIX global header, tenant selector, opportunity switcher and dynamic-page navigation folders; `DiscoveryChatWithPanel` (XMS renders its own Axel panel over a small streaming client); and the `next.config.mjs` flags that suppress type and lint errors. **XMS builds fail on either.**

## Steps

1. Work out which layer your change belongs to: a component uses tokens, a repeated recipe becomes a class in `xms-scope.css`, a genuinely new semantic value becomes a token plus a Tailwind namespace entry.
2. Pick the token from the identity table, or a `--state-*` trio if it is a signal. Never invent a hex.
3. Compose from the existing primitives and house components before building new markup.
4. Follow the screen grammar for the pattern you are building rather than inventing a layout.
5. Check density against the wireframe scale: 11px caps labels, 12px meta, 13px body and cells, 14px titles and inputs, 15px card titles, mono scorecard numbers; finder bar 56px, content header 44px, sidebar 238px, controls 32 to 34px.
6. Toggle `.dark` and confirm surfaces, text and borders invert.

## Checkpoints

- Every colour a token, with no raw hex outside the token files?
- Body text `--xms-ink`, with no `text-gray-*` or `text-slate-*` anywhere?
- Signals on `--state-*` trios, with the accent never colouring a signal, and P3 and P4 left quiet?
- Dense list with no striping, hairline rows, sticky header, row then cell hover?
- No account accent leaking into the internal working UI?
- Copy free of em-dashes?
- Reads correctly with `.dark` on, and the portal still defaults to light?
