---
name: "xms-web-data-endpoint"
description: 'Wire the data layer for an XMS Web feature: an RTK Query endpoint against the /v1 API with generated types and cache tags, or the Axel streaming client for an AI turn. Use when adding or extending server data access, adding a mutation, fixing a stale list after a write, wiring the Axel panel, or when a task says "fetch this", "the list does not refresh", "hook this up to the API". Covers the generated contract types, tag invalidation, why the client never sends an account id, and the server-authority rule.'
---

# Skill: Wire the XMS Web Data Layer

XMS Web has two sanctioned ways to reach the server. Pick one deliberately and do not add a third hand-rolled `fetch`.

1. **RTK Query** for server data and CRUD, against the `/v1` API.
2. **The Axel streaming client** (`frontend/lib/axel-client`) for AI turns, which relay SSE through the API's Axel adapter.

The frontend consumes the backend through **its OpenAPI document and generated types** (ADR-12, ADR-14). The contract is generated from `backend/src/contracts`; there is no workspace tooling joining the repos.

## The rule that shapes everything: the server is the author

The server is the only author of SLA due times, breach latches, derived priority, burn-down and permissions. **The browser renders and counts down.** So:

- Never recompute a due time, a breach, or a priority from raw fields in a component or a selector.
- Never gate UI on a permission string you assembled client-side. Render from the permissions the server returned.
- A countdown ticking against a server-provided due time is fine. Deciding that it breached is not.

## Mechanism 1: an RTK Query endpoint

### Steps

1. **Regenerate the client types** from the API's OpenAPI document after the backend contract changes. Do not hand-write a DTO that duplicates `backend/src/contracts`; a hand-written copy is how the two repos drift.
2. **Add the endpoint** to the relevant slice through `injectEndpoints` on the XMS base API, with the generated request and response types and re-exported hooks.
3. **Set cache tags, every time.** `providesTags` on queries, `invalidatesTags` on mutations. If you introduce a **new tag name you must also add it to the base API `tagTypes` array**, or invalidation silently never matches and there is no type error to catch it. Keep composite tag ids symmetric between the query that provides and the mutations that invalidate.
4. **Let the base query own auth.** It attaches the Clerk token per request. Anything that bypasses it loses authentication.
5. **Send no account id.** There is no tenancy header and no account parameter. The API resolves a `Principal` once per request and derives the account set from the token and the user's grants. A client-supplied account id is a bug, and the server will not honour it.
6. **Respect the realm.** Internal screens call operator routes; the portal route group calls portal routes. A portal token on an operator route is a 403 by design, so do not share a slice across the two realms without checking which routes it hits.

### Pitfalls

- A new tag missing from `tagTypes`, giving a permanently stale list after a write.
- A raw `fetch` that skips the base query and therefore the token.
- Caching the same entity in RTK Query and a Redux slice and `useState`, then watching them drift.
- Hand-written DTOs that no longer match the generated contract.
- Optimistic updates on anything the server derives (SLA state, priority, permissions). Optimism is for the fields the user typed.

## Mechanism 2: the Axel panel

All AI calls go through the Axel adapter. **Nothing in the frontend holds a harness credential.**

- The panel calls the XMS API, which checks the account's AI switch, exchanges the user's Clerk token for a harness session token, and relays the harness SSE. The browser never calls the harness directly.
- Use the streaming client in `frontend/lib/axel-client`. Handle the frame types the adapter relays (content, tool call, attachment, thread created, done) and **capture the stream id so the turn can be cancelled**.
- Suggestions are server-persisted rows, not client state. Render them from the API and let confirmation go back through a mutation, then invalidate the tag so the record view refreshes.
- When an account has AI switched off, no call is made at all. Render the off state from the account settings the server returned rather than calling and handling a failure.

## Checkpoints

- Are the types generated from the OpenAPI document rather than hand-written?
- Does every query set `providesTags` and every mutation `invalidatesTags`, with any new tag registered in `tagTypes`?
- Does every request go through the base query, with no raw `fetch`?
- Is there no account id and no tenancy header anywhere in the request?
- Does the screen render server-authored SLA, priority and permission values rather than deriving them?
- For AI work, does everything route through the Axel adapter, with the stream id captured for cancel?
