import 'server-only';

import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { config, Upstream } from './config';
import { serviceIdentity } from './backend';
import {
  AwsIdentity,
  PlatformIdentity,
  PlatformSnapshot,
  ServiceReport,
} from './types';

/**
 * The evidence behind the proof page.
 *
 * Two jobs. First, describe this service the same way every other XMS service
 * describes itself, so the four cards on /platform are comparable. Second,
 * fan out to the other three over cluster DNS and collect what they say.
 *
 * This file is shared by `app/api/platform/route.ts`, which serialises the
 * snapshot as JSON, and by `app/platform/page.tsx`, which renders it. The
 * page calls this function directly rather than making an HTTP request to its
 * own API route: a server talking to itself over the loopback interface to
 * render its own page is a hop that buys nothing. The route exists so the
 * same document is available to a browser, to curl and to a monitor.
 */

/* -------------------------------------------------- this service's own -- */

async function awsIdentity(): Promise<AwsIdentity> {
  // IRSA hands the pod these two variables and a projected token file. Their
  // presence is what distinguishes a web-identity role from anything else.
  const webIdentityFile = process.env.AWS_WEB_IDENTITY_TOKEN_FILE;
  const roleArn = process.env.AWS_ROLE_ARN ?? null;
  const credentialSource = webIdentityFile
    ? 'IRSA (sts:AssumeRoleWithWebIdentity via the cluster OIDC provider)'
    : process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI ||
        process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI
      ? 'EKS Pod Identity / container credentials'
      : 'ambient (local profile or instance role)';

  try {
    // One attempt. A page whose purpose is to answer quickly should not spend
    // thirty seconds retrying a credential chain that is simply not there,
    // which is exactly the local-development case.
    const sts = new STSClient({ region: config().region, maxAttempts: 1 });
    const out = await sts.send(new GetCallerIdentityCommand({}), {
      abortSignal: AbortSignal.timeout(5_000),
    });
    return {
      arn: out.Arn ?? null,
      accountId: out.Account ?? null,
      userId: out.UserId ?? null,
      credentialSource,
      irsaRoleArn: roleArn,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      arn: null,
      accountId: null,
      userId: null,
      credentialSource,
      irsaRoleArn: roleArn,
      error: message,
    };
  }
}

const NO_SECRETS_NOTE =
  'This service holds no secrets and no database credential. It has no Vault ' +
  'mount, no Vault role and no database user. Everything it needs is a URL, ' +
  'and the data it shows belongs to the services behind it.';

export async function ownIdentity(): Promise<PlatformIdentity> {
  const cfg = config();

  return {
    service: cfg.serviceName,
    environment: cfg.environment,
    generatedAt: new Date().toISOString(),
    kubernetes: cfg.kubernetes,
    aws: await awsIdentity(),
    vault: {
      enabled: false,
      note: NO_SECRETS_NOTE,
    },
    database: {
      enabled: false,
      note: NO_SECRETS_NOTE,
    },
    noPasswordProof: {
      // Nothing sets this here, and if anything ever does, this page says so.
      databasePasswordEnvPresent: Boolean(process.env.DATABASE_PASSWORD),
      // No Vault mount, so there are no keys at all to match.
      vaultKeysMatchingPassword: [],
      // Both are a database's answer, and there is no database to ask.
      roleHasPasswordSet: null,
      rdsIamGranted: null,
    },
  };
}

/* ------------------------------------------------------------- fan-out -- */

async function report(upstream: Upstream): Promise<ServiceReport> {
  const started = Date.now();
  try {
    const identity = await serviceIdentity(upstream);
    return {
      name: upstream.name,
      role: upstream.role,
      upstreamUrl: `${upstream.url}/platform/identity`,
      reachable: true,
      durationMs: Date.now() - started,
      identity,
      error: null,
    };
  } catch (err) {
    // THE ONE PLACE THAT SWALLOWS AN ERROR, and only into a rendered field.
    //
    // This page is a diagnostic tool. Its job is to say which services are
    // healthy and which are not, so a single unreachable upstream must not
    // take the other three cards with it. The failure is not discarded: it is
    // logged here and printed on the card, in full, as the card's content.
    //
    // Nowhere else in this codebase is allowed to do this.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`platform snapshot: ${upstream.name} failed — ${message}`);
    return {
      name: upstream.name,
      role: upstream.role,
      upstreamUrl: `${upstream.url}/platform/identity`,
      reachable: false,
      durationMs: Date.now() - started,
      identity: null,
      error: message,
    };
  }
}

/**
 * The whole document: this service first, then the three it fronts, gathered
 * concurrently so the page costs one round trip rather than three.
 */
export async function collectPlatformSnapshot(): Promise<PlatformSnapshot> {
  const cfg = config();
  const { backend, worker, mcp } = cfg.upstreams;

  const [self, ...rest] = await Promise.all([
    ownIdentity(),
    report(backend),
    report(worker),
    report(mcp),
  ]);

  const selfReport: ServiceReport = {
    name: cfg.serviceName,
    role:
      'Backend-for-frontend. The only service with a public gateway; every ' +
      'card below it was fetched by this process, not by the browser.',
    upstreamUrl: null,
    reachable: true,
    durationMs: 0,
    identity: self,
    error: null,
  };

  return {
    generatedAt: new Date().toISOString(),
    assembledBy: cfg.serviceName,
    environment: cfg.environment,
    services: [selfReport, ...rest],
  };
}
