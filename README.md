# frontend (`xms-web`)

The Next.js and React application for XMS. It serves two hosts from one codebase: the internal desk at `xms.<domain>` and the client portal at `portal.<domain>`.

Not scaffolded yet. The specification that governs it:

- Screens and flows: `../01-architecture/USER-EXPERIENCE.md`
- Tokens, component grammar, portal variant: `../01-architecture/DESIGN-SYSTEM.md`
- Axel panel and streaming client: `../01-architecture/AI-INTEGRATION.md` §3 and `../02-modules/ai-functionality/TECHNICAL-SPEC.md` §6
- Per-module client changes: section 6 of every `../02-modules/*/TECHNICAL-SPEC.md`

Planned layout (ADR-12, ADR-14):

```
frontend/
  app/                 App Router; route groups (internal) and (portal)
  components/          shadcn primitives plus the XMS composition components (SortableTable, Panel, TabBar, ScoreCard, record form, condition builder)
  lib/axel-client/     the small SSE streaming client for the Axel adapter
  redux/               RTK Query base API and per-module slices, generated types from the backend OpenAPI document
  styles/tokens/       aiinnovation-tokens.css (vendored), house.css, xms-scope.css, tailwind preset
  e2e/                 Playwright golden paths
```

Stack: Next.js (App Router), React, TypeScript, RTK Query, Clerk, Tailwind, Vitest, Playwright. Build fails on lint or type errors.
