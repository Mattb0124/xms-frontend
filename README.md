# xms-frontend

The XMS user interface, and the only service on this platform that the
internet can reach. Everything else — `xms-backend`, `xms-worker`, `xms-mcp` —
sits behind it on the cluster network with no public gateway at all.

That arrangement is called a **backend-for-frontend**, or BFF, and this
repository is the reference for it. If you are about to write another service
on XMS, or another front end, read `lib/backend.ts` and
`app/api/platform/route.ts` first; between them they contain the whole idea.

---

## Why the browser only ever talks to this service

A conventional single-page app ships JavaScript that calls the API directly
from the user's machine. Doing that on this platform would mean three things
we do not want.

**Every internal service would need a public address.** The backend, the
worker and the MCP server would each need an ALB, a hostname, a certificate
and a WAF rule, and each would become a thing an attacker can reach and
fingerprint. Instead they are `ClusterIP` Services. Their addresses —
`xms-backend.xms.svc.cluster.local` and friends — resolve only inside the
cluster. A browser cannot connect to them from any network, including the
VPN, because the name means nothing to any resolver but the cluster's.

**Every internal service would need CORS.** Cross-origin rules are a
distributed configuration problem: one list of allowed origins per service,
kept in step by hand, each one a preflight round trip on the user's latency
budget and a place to get it subtly wrong. Here every request the browser
makes is same-origin, to this service, so there is no CORS configuration
anywhere in this estate.

**The browser would need a token.** If the page calls the API, the page holds
a credential. It lives in memory or in storage, it is visible in devtools, it
leaks into logs and error trackers, and it is valid from anywhere in the
world. With a BFF the session lives in an HTTP-only cookie on this origin and
nothing else; this service exchanges it for whatever the upstreams need, on
the server, where the exchange cannot be observed or replayed.

The property that falls out of all three: **nothing about the internal
services reaches the browser bundle**. Not an address, not a port, not a
token. The three upstream URLs are read from `BACKEND_URL`, `WORKER_URL` and
`MCP_URL` at request time, inside modules marked `import 'server-only'`. They
are not build arguments and they are emphatically not `NEXT_PUBLIC_*`, which
would inline them into the JavaScript at build time. Import any of that code
from a Client Component and the build fails rather than shipping it.

This service also holds **no secrets**: no Vault mount, no Vault role, no
database, no database credential. Its entire configuration is three URLs. The
proof page says so, and says it by reading its own process environment rather
than by asserting it.

---

## The shape of the code

```
lib/config.ts       the three upstream addresses, read per request, no defaults
lib/backend.ts      the ONLY code that knows how to reach an internal service
lib/platform.ts     this service's own identity, and the fan-out to the others
lib/validate.ts     boundary validation, shared by the route and the action
lib/types.ts        the wire shapes, transcribed from the backend

app/api/items       GET and POST, proxied to xms-backend
app/api/platform    the aggregate identity document
app/healthz, readyz the chart's probe targets
app/page.tsx        the items page
app/platform        the proof page, and its one Client Component
```

`lib/backend.ts` is the narrow waist. One function issues every outbound
request, which means the timeout, the error shape and — when we add it — the
session check exist exactly once. There is a long comment in that file marking
precisely where authentication goes and what it should and should not
forward. It is the first question everyone asks, so it is answered there
rather than in a ticket.

**Errors are loud.** A non-2xx from an upstream throws an `UpstreamError`
carrying the service, the URL, the status and the body. Nothing returns an
empty array on failure, because an empty array renders as a page that looks
fine. There is exactly one exception in the whole codebase, in
`lib/platform.ts`: the proof page tolerates a failure *per upstream*, so that
one dead service cannot blank a diagnostic tool at the moment you need it.
The failure is still printed, in full, on that service's card. Nowhere else
is allowed to do this, and the comment next to the `catch` says so.

---

## Running it locally

You need the backend up. It lives in `../xms-backend` and serves on port 3000:

```bash
cd ../xms-backend && docker compose up -d
```

Then, in this repository:

```bash
docker compose up --build        # http://localhost:3001
```

The front end is published on 3001 so it does not collide with the backend's
3000; inside the container it listens on 3000, exactly as it does in the
cluster. `docker-compose.yml` points `BACKEND_URL` at
`host.docker.internal:3000` and is usable on its own — this service has
nothing to stand up alongside it.

Without Docker:

```bash
cp .env.example .env
npm install
npm run dev                      # http://localhost:3000, so stop the backend
                                 # or change PORT
```

`../xms-worker` and `../xms-mcp` have their own compose files and publish
3002 and 8000; the defaults here point at them, so bring them up if you want
all four cards populated. You do not have to. Leave one down — or stop it
mid-session — and its card on `/platform` comes back **unreachable** with the
connection error printed on it while everything else renders normally. That
is the per-upstream error tolerance doing its job, and it is worth seeing
once.

---

## Reading the proof page

`/platform` is the deliverable. It renders one card per service, and every
value on it was read live, at the moment you loaded the page, by the service
it describes — not copied out of a config file, because configuration is the
thing being verified.

**Kubernetes** — pod, namespace, node and service account, from the downward
API. Empty means the process is not in a pod, which outside the cluster is the
right answer.

**AWS identity** — the ARN, account and user id that `sts:GetCallerIdentity`
returned just now, plus how the credentials were obtained. `IRSA` means the
pod exchanged its projected service-account token for a role through the
cluster's OIDC provider. Anything else on a cluster pod is a finding.

**Vault** — the mount, the role, and for each path the number of keys and
their **names**. Never a value: `/platform/identity` does not return one, so
one cannot reach this page.

**Database** — the auth method, highlighted. `aws-iam-token` is what you want
to see: a signed credential minted for that connection, not a password.
Alongside it the host, SSL mode, schema, the current database user and the
server version, read from the Postgres catalogue.

**IAM token** — issued-at, expires-at, and a live countdown. The countdown is
the only client-side thing on the page and it exists to make one point
unmissable: the credential is minutes old and will be gone in minutes more.
It is not a secret anyone could have copied.

**TLS** — whether the session is encrypted and with what, from `pg_stat_ssl`.
That is the *server's* account of the connection, not the client's claim
about it.

**No-password proof** — a checklist, because the negative is the hard part.
`databasePasswordEnvPresent` should be false, `vaultKeysMatchingPassword`
should be empty and `rdsIamGranted` should be true. One entry deserves
explanation: `roleHasPasswordSet: null` means *the role cannot read
`pg_authid`*, which only a superuser can. **That is expected and is not a
failure.** "Cannot see a password" is a weaker claim than "there is no
password", so it is reported as null rather than quietly upgraded to the
stronger one. The `rds_iam` membership check above it is what actually settles
whether password authentication is possible at all.

Running locally you will see the backend's card *fail* several of these: it
uses a password against a local Postgres, because there is no IAM outside
AWS. The page is telling the truth, and the fact that it looks different in
the cluster is the proof.

At the top, a short trail spells out how the page was assembled: one browser
request to this origin, then three concurrent server-side calls over cluster
DNS, with the actual upstream URLs listed. The same document is available as JSON at `/api/platform`.

---

## How it deploys

`azure-pipelines.yml` extends `delivery/pipelines/build-deploy.yml` from the
`AwsAccountXms` platform repository, which owns the registry, the deploy role,
the cluster and the chart for every XMS service. This repository supplies only
what makes it different: the service name, `xms/frontend` as the ECR
repository, port 3000, and a `smokeUrl` — because this service has a public
gateway, so a rollout is not finished until the internet can actually reach
it.

`deploy/values-dev.yaml` is the other half. It sets `vault.enabled: false`,
turns on **both** gateways (public
`xms-frontend.dev.xms.aix.thehackettgroup.com`, internal
`xms-frontend.dev.xms.int`) and supplies the three cluster-DNS upstream URLs
as plain environment values. If you ever find yourself switching
`vault.enabled` on here, stop: this service is not supposed to hold anything
worth protecting, and needing Vault would mean the pattern has drifted.

The image is a two-stage build on `node:24-alpine` using Next's
`output: "standalone"`, so the runtime stage carries a traced server and
nothing else. It runs as the non-root `node` user and exposes 3000. Unlike the
other XMS services there is no RDS trust bundle in the image — there is no
database to verify a certificate for.

`/healthz` and `/readyz` report only that this process is serving. They deliberately do not
check the upstreams: this service is at its most useful when they are down,
and making its readiness depend on theirs would pull it out of the load
balancer exactly when an operator needs `/platform`.

---

## Adding authentication later

Read the header comment in `lib/backend.ts`. Two edits, both in that file: a
session check before the fetch, and forwarded identity headers on it. The
upstreams read those headers instead of parsing a token, and they may trust
them because nothing but this service can reach them — pin that with a
NetworkPolicy so the trust is enforced rather than assumed.

What must not happen: putting the session token itself in those headers, or
handing the browser a token so it can call an upstream directly. Both
re-export the blast radius the BFF exists to contain.

---

## Notes on the dependency list

Four runtime dependencies: `next`, `react`, `react-dom`, and
`@aws-sdk/client-sts` for the live identity call on the proof page. No UI
framework, no CSS framework, no icon set, no font package. The styling is one
stylesheet, `app/globals.css`, built on CSS variables so that dark mode is a
palette swap rather than a second set of rules.

TypeScript is pinned to `~6.0.3`. TypeScript 7.0 ships only the `tsc`
executable and drops the programmatic compiler API that Next's (and Nest's)
tooling calls into, so every service in this estate stays on 6 until that is
resolved.
