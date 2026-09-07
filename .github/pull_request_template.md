## What and why

<!-- One paragraph. Link the Implementation Plan item (P<phase>.<sprint>.<n>) and the spec section. -->

Item: P
Spec:

## Threat note

<!-- What could this change break for isolation, visibility, realm, evidence or egress, and why it does not. -->

## Security definition of done (xms-security-first, ADR-16)

An unticked box blocks the merge.

- [ ] Isolation: nothing in the browser decides authorisation; UI gating mirrors the server and fails closed while loading
- [ ] Visibility: the portal route group renders only portal view models; no internal field (work notes, rates, AI suggestions, audit rows) can reach a portal screen
- [ ] Realm: portal and internal surfaces stay separate; no cross-imports that could leak fields
- [ ] Evidence: screens declare a `screen` id; key actions use `useTrack`; telemetry carries identifiers and structured facts only, never ticket, email or article text
- [ ] Egress: no secrets or server-only values in `NEXT_PUBLIC_*`; CSP untouched or updated with a reason; downloads and uploads only through presigned URLs minted by the API
- [ ] Inputs: no `dangerouslySetInnerHTML` without a sanitiser and a review comment
- [ ] Wireframe alignment: tokens only (no raw hex), no row striping, state ramp for states, signal trios for SLA and priority, violet for AI content only (ADR-17, ADR-18)
- [ ] Tests: unit tests for logic, component tests for behaviour, Playwright for any new golden path; `pnpm check` green
- [ ] Copy: no em-dashes; ServiceNow vocabulary where it aids adoption

## Screens

<!-- Screenshots or the wireframe reference (01-architecture/wireframes/...) for anything visual. -->
