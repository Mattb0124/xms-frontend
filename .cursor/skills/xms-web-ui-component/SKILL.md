---
name: "xms-web-ui-component"
description: 'Scaffold a new shared UI primitive in frontend/components/ui following the house shadcn and Radix pattern (cva variants, cn, forwardRef, asChild, XMS tokens). Use when adding a reusable component to frontend, when you are about to write a styled div cluster that other features will copy, or when a task says "make this reusable", "add a primitive", "extract this component". Covers the file template, the token rules, Radix compounds, and the export contract.'
---

# Skill: Scaffold a Shared UI Component

Reusable primitives live in `frontend/components/ui/*` as shadcn-style Radix wrappers. They are **regenerated with the shadcn CLI in XMS, not copied from AIX**, so versions are XMS-owned (`01-architecture/DESIGN-SYSTEM.md` §2). New shared components match this template so they stay tokenized, themeable and consistent.

Companion skills: `xms-web-design-system` for which token to use, `no-hardcoded-styling` for where a style may live, `xms-web-data-table` for tables specifically.

## When to use

- A component will be reused across features (a control, a badge, a card, an input, an overlay).
- You are about to write an ad-hoc styled `div` cluster that other features will copy. Make it a primitive instead.

## Check first: does it already exist?

The shadcn set XMS carries is `button`, `dialog`, `select`, `popover`, `command`, `table`, `sheet`, `tabs`, `tooltip`, `form`, `toast`, `skeleton`, `resizable`, `scroll-area`. The house composition components are `SortableTable`, `Panel`, `TabBar` and `ScoreCard`. Status pills already exist as `.aix-state-pill` and `.xms-pill` driven by the `--state-*` trios, so **do not build another status pill component**. Extend what is there before adding a new file.

## Steps

### 1. Create the file

`frontend/components/ui/<name>.tsx`, kebab-case filename (never PascalCase). For a leaf primitive use the cva template:

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const recordChipVariants = cva("inline-flex items-center rounded border px-2 py-0.5 text-[13px] font-medium", {
  variants: {
    tone: {
      neutral: "border-xms-line bg-xms-card text-xms-ink",
      selected: "border-xms-accent bg-xms-tint text-xms-ink",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export interface RecordChipProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof recordChipVariants> {}

const RecordChip = React.forwardRef<HTMLSpanElement, RecordChipProps>(({ className, tone, ...props }, ref) => (
  <span ref={ref} className={cn(recordChipVariants({ tone }), className)} {...props} />
));
RecordChip.displayName = "RecordChip";

export { RecordChip, recordChipVariants };
```

### 2. Tokens only, no hex

Every colour is an `xms-*` token (or an `aiinds-*` token where no identity token fits). No `text-gray-*`, no `text-slate-*`, no `bg-[#hex]`. The scope has a no gray text policy, and hardcoded values will not flip in dark mode.

Geometry comes from the density scale: 13.5 to 14px body, 34px controls, 32px buttons, 4px radii.

### 3. Signals use the state trios

If the component expresses SLA, priority, status or scan state, drive it from the `--state-*` trios via `stateTrio(name)`. Never re-theme a signal to the identity accent, and never invent a colour per state.

### 4. Radix compounds

When wrapping a Radix primitive, mirror the compound export shape used by `dialog.tsx` and `select.tsx` (Root, Trigger, Content subcomponents, `asChild` via `@radix-ui/react-slot`). Tooltips need a single `<TooltipProvider>` at the app root; toasts a single `<Toaster>`.

### 5. Export contract

Export the component, its `displayName`, and the `*Variants` object so consumers can compose variants. Keep the file free of feature and business logic: no data fetching, no permission checks, no SLA math. The server is the author of SLA due times, breach latches, derived priority and permissions; a primitive only renders what it is given.

### 6. Adopt it

Replace the inline duplicates you were about to write, or an existing one-off, with the new primitive. If nothing adopts it, it was not a primitive.

## Checkpoints

- Does an existing primitive or house component already cover this?
- Kebab-case filename in `frontend/components/ui/`, cva variants, `cn`, `forwardRef`, `displayName`, `*Variants` exported?
- Every colour a token, with no hex, no `text-gray-*`, no arbitrary sizes?
- Signals driven by `--state-*` trios rather than bespoke colours?
- Free of business logic and data access?
- Correct in dark mode with `.dark` on?
