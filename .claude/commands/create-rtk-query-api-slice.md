---
description: 'Scaffold a new RTK Query API slice in XMS Web with generated contract types, cache tags registered on the base API, and re-exported hooks, so data fetching stays consistent, authenticated and correctly invalidated.'
---

# Create an RTK Query API Slice

Scaffold a new data-fetching slice in `frontend` against the `/v1` API, following the shared template so it reuses the configured auth base query and tag-based cache invalidation. The deeper invariants live in the `xms-web-data-endpoint` skill; this command is the scaffold.

## Checkpoints before you start

- What resource does this slice cover, and which endpoints are queries versus mutations?
- Is it an operator route or a portal route? The realms are enforced server-side.
- Which cache tags do the endpoints provide and invalidate?

## Steps

### 1. Regenerate the contract types

The web client types are generated from the API's OpenAPI document, which is generated from `backend/src/contracts`. Regenerate after any backend contract change. **Do not hand-write request or response interfaces that duplicate the contract**; a hand-written copy is how the two repositories drift.

### 2. Create the slice file

Add the slice alongside the existing ones and import the XMS base API plus the generated types.

### 3. Inject endpoints

Export the slice via `injectEndpoints` on the base API, using `builder.query` and `builder.mutation` with the generated types.

### 4. Set cache tags

`providesTags` on every query, `invalidatesTags` on every mutation. Keep composite tag ids symmetric between the query that provides and the mutations that invalidate.

### 5. Register new tags

If you introduce a new tag name, **add it to the base API `tagTypes` array**. Miss this and invalidation silently never matches, with no type error to catch it.

### 6. Re-export hooks

Re-export the generated hooks and use them in components.

### 7. Do not send tenancy

There is no tenancy header and no account parameter. The API resolves a `Principal` per request and derives the account set from the token and the user's grants. Let the base query attach the token; never bypass it with a raw `fetch`.

### 8. Render, do not derive

SLA due times, breach latches, derived priority, burn-down and permissions come from the server. The browser renders and counts down.
