---
description: 'Run the local lint, format, type-check, unit test and build gates for XMS Web before opening a pull request, reproducing the pipeline gates so failures are found before review rather than in CI.'
---

# Pre-PR Quality Check (frontend)

Run the gates locally before opening a pull request. The XMS pipeline runs lint, type-check, unit, integration and isolation tests **before** it builds an image, and a red step stops the pipeline with no flag to skip a gate (`03-delivery/TEST-STRATEGY.md` §5). Running them here means you find the failure in seconds instead of after a push.

## When to use

- Before creating a pull request in `frontend`.
- After a merge or rebase that touched shared code.
- When the pipeline went red and you want to reproduce it locally.

## Steps

### 1. Install

```bash
pnpm install --frozen-lockfile
```

A drifted lockfile is itself a failure. Do not "fix" it by installing unfrozen.

### 2. Lint and format

```bash
pnpm lint
pnpm format:check
```

### 3. Type-check

```bash
pnpm tsc --noEmit
```

### 4. Unit tests

```bash
pnpm vitest run
```

XMS Web uses **Vitest**, not Jest. Cover pure logic (SLA display math, condition builder serialisation, form validation) and component behaviour with Testing Library.

### 5. Build

```bash
pnpm build
```

### 6. End to end (when the change touches a golden path)

```bash
pnpm playwright test
```

Playwright runs against a seeded environment, so run it when your change affects create by form, working a ticket to close, the portal account boundary, or the report pack download.

## The rule that is not negotiable

`ignoreBuildErrors` and `ignoreDuringBuilds` are **forbidden** in the Next config and a lint rule enforces it. If the build fails on a type or lint error, fix the error. Suppressing it violates the Packmind standard "Do Not Suppress Type-Check and Lint Errors in Builds" and the build will fail anyway.

## Before you open the PR

- Every gate above passed, not just the ones related to your change.
- Tests ship with the change, in the same pull request.
- New UI is tokenized (`no-hardcoded-styling`) and correct in dark mode.
