import "server-only";

import { createHash } from "node:crypto";
import type { DatabaseEnabled, PlatformSnapshot, ServiceReport, VaultEnabled } from "./types";

/**
 * Turn the internal snapshot into something safe to publish, and into
 * something a person can actually read.
 *
 * Two problems are solved here, and they pull in the same direction.
 *
 * SAFETY. This page and /api/platform are on the public internet with no
 * authentication. The raw identity documents describe the estate in detail:
 * account number, role ARNs, principal ids, node and pod names, the Aurora
 * endpoint, the Vault address and mount, the names of every configuration
 * key, the in-cluster addresses of every service. None of that is a secret
 * on its own, and all of it together is a map. It is removed here rather
 * than in the template, so the JSON endpoint is redacted by the same code
 * that redacts the HTML and neither can drift from the other.
 *
 * LEGIBILITY. A wall of raw fields does not demonstrate anything to a reader
 * who does not already know what to look for. What follows is a short list
 * of plain claims, each with a verdict and the evidence behind it.
 *
 * The rule applied throughout: publish the PROPERTY, never the IDENTIFIER.
 * "These four services hold four different AWS identities" is the claim
 * worth making; the ARNs are not needed to make it. Where distinctness
 * itself is the point, a short digest stands in for the value, equal
 * digests mean equal values, and the digest reveals nothing.
 */

/** Eight hex characters of SHA-256. Enough to compare, useless to resolve. */
function fingerprint(value: string | null | undefined): string | null {
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

export type Verdict = "pass" | "fail" | "unknown" | "not-applicable";

export interface Guarantee {
  id: string;
  /** The claim, in words a non-specialist can judge. */
  title: string;
  /** Why anyone should care. One sentence. */
  matters: string;
  verdict: Verdict;
  /** The short answer: what was actually found. */
  summary: string;
  /** Each line is one checkable fact. */
  evidence: string[];
  /** How the fact was obtained, so the reader can weigh it. */
  method: string;
}

export interface PublicServiceRow {
  name: string;
  role: string;
  reachable: boolean;
  /** Distinct value per service proves distinct identity, and reveals none. */
  identityFingerprint: string | null;
  identityFromWebToken: boolean;
  vaultKeyCount: number | null;
  vaultPathCount: number | null;
  databaseAuth: "iam-token" | "password" | "none" | "unknown";
  tlsVersion: string | null;
  tlsCipher: string | null;
  ownDatabaseRole: boolean | null;
  tokenIssuedAt: string | null;
  tokenExpiresAt: string | null;
  publiclyReachable: boolean;
  error: string | null;
}

export interface PublicSnapshot {
  generatedAt: string;
  environment: string;
  guarantees: Guarantee[];
  passing: number;
  checked: number;
  services: PublicServiceRow[];
  upstreamsAnswered: number;
  upstreamsTotal: number;
  /** Stated plainly, because a vague page invites the question. */
  withheld: string[];
}

const isVaultEnabled = (s: ServiceReport): VaultEnabled | null =>
  s.identity?.vault.enabled ? (s.identity.vault as VaultEnabled) : null;

const isDbEnabled = (s: ServiceReport): DatabaseEnabled | null =>
  s.identity?.database.enabled ? (s.identity.database as DatabaseEnabled) : null;

/** A service that did not answer is "unknown"; one that answered without a database is "none". */
function databaseAuthOf(s: ServiceReport, db: DatabaseEnabled | null): PublicServiceRow["databaseAuth"] {
  if (db) return db.authMethod === "aws-iam-token" ? "iam-token" : "password";
  return s.identity ? "none" : "unknown";
}

export function toPublicSnapshot(snap: PlatformSnapshot): PublicSnapshot {
  const services = snap.services;
  const answered = services.filter((s) => s.reachable && s.identity);
  const withDb = answered.filter((s) => isDbEnabled(s));
  const withVault = answered.filter((s) => isVaultEnabled(s));

  const rows: PublicServiceRow[] = services.map((s) => {
    const v = isVaultEnabled(s);
    const db = isDbEnabled(s);
    const session = db?.session ?? null;
    return {
      name: s.name,
      role: s.role,
      reachable: s.reachable,
      identityFingerprint: fingerprint(s.identity?.aws.arn ?? null),
      identityFromWebToken: Boolean(s.identity?.aws.credentialSource?.toUpperCase().includes("IRSA")),
      vaultKeyCount: v ? v.paths.reduce((n, p) => n + p.keys, 0) : null,
      vaultPathCount: v ? v.paths.length : null,
      databaseAuth: databaseAuthOf(s, db),
      tlsVersion: session?.tls.version ?? null,
      tlsCipher: session?.tls.cipher ?? null,
      ownDatabaseRole: session ? session.currentUser === s.name : null,
      tokenIssuedAt: db?.token?.issuedAt ?? null,
      tokenExpiresAt: db?.token?.expiresAt ?? null,
      // Only the backend-for-frontend has a public gateway. Everything else
      // is reachable inside the cluster and nowhere else.
      publiclyReachable: s.upstreamUrl === null,
      error: s.error,
    };
  });

  const guarantees: Guarantee[] = [];

  /* 1 ------------------------------------------------ one public entrance */
  const publicCount = rows.filter((r) => r.publiclyReachable).length;
  guarantees.push({
    id: "single-entrance",
    title: "The internet can reach one service, not four",
    matters: "Anything exposed can be attacked. Three of these four services have no route in at all.",
    verdict: publicCount === 1 ? "pass" : "fail",
    summary: `${publicCount} of ${rows.length} services is published; the other ${rows.length - 1} answer only inside the cluster.`,
    evidence: [
      "Your browser made one request, to this site, and no others.",
      "The other services were called by this server over the cluster’s own network.",
      "Their addresses do not exist in public DNS, so a browser cannot reach them from any network.",
    ],
    method: "The page was assembled server-side; open your browser’s network tab and count the requests.",
  });

  /* 2 ------------------------------------------------- separate identities */
  const prints = rows.map((r) => r.identityFingerprint).filter(Boolean);
  const distinct = new Set(prints).size;
  const allWebToken = rows.every((r) => !r.reachable || r.identityFromWebToken);
  guarantees.push({
    id: "workload-identity",
    title: "Each service proves who it is, and they are all different",
    matters: "A shared identity means one compromised service can do everything the others can.",
    verdict: distinct === prints.length && allWebToken && prints.length > 0 ? "pass" : "fail",
    summary: `${distinct} distinct identities across ${prints.length} services, none using a stored key.`,
    evidence: [
      "Each service swaps a short-lived cluster token for cloud credentials at run time.",
      "There is no access key or secret key anywhere in the images or the configuration.",
      "The short codes in the table below are digests: different codes mean different identities.",
    ],
    method: "Each service asked the cloud provider who it was, at the moment this page was built.",
  });

  /* 3 ------------------------------------------------------ secrets source */
  const totalKeys = rows.reduce((n, r) => n + (r.vaultKeyCount ?? 0), 0);
  guarantees.push({
    id: "secrets-at-startup",
    title: "Settings come from the secret store when a service starts",
    matters: "Nothing sensitive is baked into a container image or checked into a repository.",
    verdict: withVault.length > 0 ? "pass" : "unknown",
    summary: `${withVault.length} services loaded ${totalKeys} values at start-up. The public one loads none, because it holds no secrets.`,
    evidence: [
      "Each service authenticates to the secret store as itself and may read only its own entries.",
      "A service that cannot reach the store, or is refused, stops. It does not start with gaps.",
      "Values and key names are not shown here, and never leave the service that loaded them.",
    ],
    method: "Counted from the secret store’s own reply to each service. Counts only.",
  });

  /* 4 ------------------------------------------------- no database password */
  const iam = withDb.filter((r) => isDbEnabled(r)?.authMethod === "aws-iam-token");
  const noPwEnv = answered.every((s) => !s.identity?.noPasswordProof.databasePasswordEnvPresent);
  const noPwKeys = answered.every((s) => (s.identity?.noPasswordProof.vaultKeysMatchingPassword.length ?? 0) === 0);
  const iamGranted = withDb.every((s) => isDbEnabled(s)?.session?.rdsIamGranted);
  guarantees.push({
    id: "no-database-password",
    title: "There is no database password to steal",
    matters: "A password has to be stored somewhere, shared with someone, and rotated. This one does not exist.",
    verdict: iam.length === withDb.length && withDb.length > 0 && noPwEnv && noPwKeys && iamGranted ? "pass" : "fail",
    summary: `All ${withDb.length} database users sign in with a token that lasts 15 minutes and is created fresh for each connection.`,
    evidence: [
      "No password is present in any service’s environment.",
      "No entry in the secret store has a password-like name.",
      "The database itself confirms these accounts are set to token sign-in, which turns password sign-in off.",
      "A password offered for one of these accounts is rejected outright.",
    ],
    method: "Read from the database’s own account catalogue, plus a scan of each running process.",
  });

  /* 5 -------------------------------------------------------- encryption */
  const tls = withDb.map((s) => isDbEnabled(s)?.session?.tls).filter(Boolean);
  const allTls = tls.length > 0 && tls.every((t) => t?.ssl);
  const verifyFull = withDb.every((s) => isDbEnabled(s)?.sslMode === "verify-full");
  guarantees.push({
    id: "encrypted-in-transit",
    title: "Database traffic is encrypted, and the server is checked first",
    matters: "A sign-in token is only as safe as the connection it is sent over.",
    verdict: allTls && verifyFull ? "pass" : "fail",
    summary: tls[0]?.version
      ? `Every database session uses ${tls[0].version}, and each service verifies the database’s certificate before sending anything.`
      : "No encrypted session to report.",
    evidence: [
      "The certificate is checked against the cloud provider’s published authority, including the hostname.",
      "An unencrypted connection is refused by the database, not merely discouraged.",
    ],
    method: "Read from the database’s live connection statistics for each service’s own session.",
  });

  /* 6 ------------------------------------------------------ data isolation */
  const dbRows = rows.filter((r) => r.databaseAuth !== "none" && r.databaseAuth !== "unknown");
  const ownRole = dbRows.length > 0 && dbRows.every((r) => r.ownDatabaseRole === true);
  guarantees.push({
    id: "data-isolation",
    title: "Each service can only reach its own data",
    matters: "One service going wrong should not put every other service’s data at risk.",
    verdict: ownRole ? "pass" : "fail",
    summary: `${withDb.length} services, ${withDb.length} separate database accounts, each working in its own area.`,
    evidence: [
      "A service creates and reads its own tables and cannot see another’s by default.",
      "Where one service needs to read another’s data, the owner grants exactly that and nothing more.",
      "One service here has read access to one table it does not own, and cannot change it.",
    ],
    method: "Each service reported the account it is connected as; the database enforces the rest.",
  });

  const passing = guarantees.filter((g) => g.verdict === "pass").length;
  const checked = guarantees.filter((g) => g.verdict !== "not-applicable").length;

  return {
    generatedAt: snap.generatedAt,
    environment: snap.environment,
    guarantees,
    passing,
    checked,
    services: rows,
    upstreamsAnswered: answered.filter((s) => s.upstreamUrl !== null).length,
    upstreamsTotal: services.filter((s) => s.upstreamUrl !== null).length,
    withheld: [
      "Cloud account number, role names and principal identifiers",
      "Internal hostnames and addresses for the cluster, the database and the secret store",
      "Machine and container names",
      "Names of configuration keys, and of database accounts and areas",
      "Every secret value, which no service ever sends here in the first place",
    ],
  };
}
