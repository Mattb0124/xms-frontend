/**
 * The wire shapes of the XMS platform.
 *
 * These are a transcription of what the internal services actually return —
 * `PlatformIdentity` in xms-backend/src/platform/platform.service.ts and
 * `Item` in xms-backend/src/items/items.service.ts. Keep them in step with
 * those files. They are hand-written rather than generated because the
 * contract is small and reading it is part of understanding the platform.
 *
 * Two fields are widened from the backend's version, on purpose:
 *
 *   database.enabled   the backend narrows this to `true`; this front end has
 *                      no database at all and reports `false`, so the union
 *                      below carries both cases.
 *
 *   vault              the same story — this service has no Vault mount, so
 *                      the disabled variant carries only a note.
 *
 * Everything else is byte-for-byte the backend's interface.
 */

/* ---------------------------------------------------------------- items -- */

export interface Item {
  id: string;
  name: string;
  note: string | null;
  created_at: string;
}

export interface CreateItemInput {
  name: string;
  note: string | null;
}

/* ------------------------------------------------------------- identity -- */

export interface KubernetesIdentity {
  pod: string | null;
  namespace: string | null;
  node: string | null;
  serviceAccount: string | null;
}

export interface AwsIdentity {
  arn: string | null;
  accountId: string | null;
  userId: string | null;
  /** How the credentials were obtained, inferred from what the pod was given. */
  credentialSource: string;
  irsaRoleArn: string | null;
  error: string | null;
}

/* ---------------------------------------------------------------- vault -- */

/** What was loaded, for the platform proof endpoint. Never any value. */
export interface VaultPathSummary {
  path: string;
  keys: number;
  keyNames: string[];
}

export interface VaultEnabled {
  enabled: true;
  address: string | null;
  authMount: string | null;
  role: string | null;
  kvMount: string | null;
  paths: VaultPathSummary[];
  loadedAt: string | null;
  skippedBecause: string | null;
}

export interface VaultDisabled {
  enabled: false;
  address?: string | null;
  authMount?: string | null;
  role?: string | null;
  kvMount?: string | null;
  paths?: VaultPathSummary[];
  loadedAt?: string | null;
  /** Reason the loader was skipped, when it was. */
  skippedBecause?: string | null;
  /** Set by services that have no Vault mount by design, such as this one. */
  note?: string;
}

export type VaultStatus = VaultEnabled | VaultDisabled;

/* ------------------------------------------------------------- database -- */

export interface TokenInfo {
  issuedAt: string;
  expiresAt: string;
  ttlSeconds: number;
}

export interface SessionFacts {
  currentUser: string;
  sessionUser: string;
  searchPath: string;
  serverVersion: string;
  database: string;
  tls: { ssl: boolean; version: string | null; cipher: string | null };
  rdsIamGranted: boolean;
  /** null when this role cannot read pg_authid, which is the normal case. */
  passwordSetForRole: boolean | null;
}

export interface DatabaseEnabled {
  enabled: true;
  authMethod: 'aws-iam-token' | 'password';
  host: string;
  port: number;
  sslMode: string;
  schema: string;
  token: TokenInfo | null;
  session: SessionFacts | null;
  error: string | null;
}

export interface DatabaseDisabled {
  enabled: false;
  /** Why there is no database, for a reader who expected one. */
  note: string;
}

export type DatabaseStatus = DatabaseEnabled | DatabaseDisabled;

/* ----------------------------------------------------------------- root -- */

export interface NoPasswordProof {
  databasePasswordEnvPresent: boolean;
  vaultKeysMatchingPassword: string[];
  roleHasPasswordSet: boolean | null;
  rdsIamGranted: boolean | null;
}

export interface PlatformIdentity {
  service: string;
  environment: string;
  generatedAt: string;
  kubernetes: KubernetesIdentity;
  aws: AwsIdentity;
  vault: VaultStatus;
  database: DatabaseStatus;
  noPasswordProof: NoPasswordProof;
}

/* ------------------------------------------------- the aggregate document -- */

/**
 * One entry per service on the proof page. `identity` and `error` are
 * mutually exclusive: an upstream either answered or it did not, and the page
 * renders whichever happened.
 */
export interface ServiceReport {
  /** The Kubernetes service name, which is also the DNS label. */
  name: string;
  /** One line on what this service is for, so the page reads on its own. */
  role: string;
  /** The exact address this server dialled. `null` for the front end itself. */
  upstreamUrl: string | null;
  reachable: boolean;
  durationMs: number;
  identity: PlatformIdentity | null;
  error: string | null;
}

export interface PlatformSnapshot {
  generatedAt: string;
  /** The service that assembled this document. */
  assembledBy: string;
  environment: string;
  services: ServiceReport[];
}
