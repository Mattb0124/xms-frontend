import {
  AwsIdentity,
  DatabaseStatus,
  KubernetesIdentity,
  NoPasswordProof,
  ServiceReport,
  SessionFacts,
  TokenInfo,
  VaultStatus,
} from '@/lib/types';
import { TokenCountdown } from './token-countdown';

/**
 * One service, one card.
 *
 * Every value rendered here was read live by the service it describes — from
 * STS, from Vault's own response, from the Postgres catalogue, from
 * pg_stat_ssl. Nothing on this card is copied from a configuration file, and
 * where a service could not answer, the card says so instead of leaving a
 * gap that reads like a zero.
 */

function Value({ children }: { children: React.ReactNode }) {
  return children === null || children === undefined || children === '' ? (
    <span className="none">not set</span>
  ) : (
    <>{children}</>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <>
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>
        <Value>{value}</Value>
      </dd>
    </>
  );
}

/* --------------------------------------------------------- kubernetes -- */

function KubernetesBlock({ k8s }: { k8s: KubernetesIdentity }) {
  const inCluster = Boolean(k8s.pod);
  return (
    <div className="block">
      <h4>Kubernetes</h4>
      {inCluster ? null : (
        <p className="meta-line" style={{ marginBottom: 10 }}>
          The downward API variables are empty, so this process is not running
          in a pod. Outside the cluster that is the correct answer.
        </p>
      )}
      <dl className="kv">
        <Row label="Pod" value={k8s.pod} mono />
        <Row label="Namespace" value={k8s.namespace} mono />
        <Row label="Node" value={k8s.node} mono />
        <Row label="Service account" value={k8s.serviceAccount} mono />
      </dl>
    </div>
  );
}

/* ---------------------------------------------------------------- aws -- */

function AwsBlock({ aws }: { aws: AwsIdentity }) {
  const viaIrsa = aws.credentialSource.startsWith('IRSA');
  return (
    <div className="block">
      <h4>AWS identity</h4>
      {aws.error ? (
        <div className="callout callout-fail" style={{ marginBottom: 12 }}>
          <strong>STS did not answer.</strong>
          <pre className="error" style={{ marginTop: 8 }}>
            {aws.error}
          </pre>
        </div>
      ) : null}
      <dl className="kv">
        <Row
          label="Caller ARN"
          value={aws.arn ?? <span className="none">unavailable</span>}
          mono
        />
        <Row label="Account" value={aws.accountId} mono />
        <Row label="User ID" value={aws.userId} mono />
        <Row
          label="Credentials from"
          value={
            <>
              <span className={`badge ${viaIrsa ? 'badge-ok' : 'badge-warn'}`}>
                {viaIrsa ? 'IRSA' : 'not IRSA'}
              </span>{' '}
              {aws.credentialSource}
            </>
          }
        />
        <Row label="AWS_ROLE_ARN" value={aws.irsaRoleArn} mono />
      </dl>
      <p className="meta-line" style={{ marginTop: 10 }}>
        Read with <code>sts:GetCallerIdentity</code> at the moment this page
        was rendered, not from an environment variable.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- vault -- */

function VaultBlock({ vault }: { vault: VaultStatus }) {
  if (!vault.enabled) {
    return (
      <div className="block">
        <h4>Vault</h4>
        <p style={{ margin: '0 0 10px' }}>
          <span className="badge badge-neutral">no vault mount</span>
        </p>
        <p style={{ margin: 0, fontSize: 13.5 }}>
          {vault.note ?? vault.skippedBecause ?? 'Vault is not configured for this service.'}
        </p>
      </div>
    );
  }

  return (
    <div className="block">
      <h4>Vault</h4>
      <dl className="kv">
        <Row label="Address" value={vault.address} mono />
        <Row label="KV mount" value={vault.kvMount} mono />
        <Row label="Auth mount" value={vault.authMount} mono />
        <Row label="Role" value={vault.role} mono />
        <Row
          label="Loaded at"
          value={vault.loadedAt ? <code>{vault.loadedAt}</code> : null}
        />
      </dl>

      <div style={{ marginTop: 12 }}>
        {vault.paths && vault.paths.length > 0 ? (
          vault.paths.map((p) => (
            <div className="vault-path" key={p.path}>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <code>{p.path === '' ? '(this service’s own path)' : p.path}</code>
                <span className="badge badge-neutral">
                  {p.keys} {p.keys === 1 ? 'key' : 'keys'}
                </span>
              </div>
              <div className="chips">
                {p.keyNames.map((k) => (
                  <span className="chip" key={k}>
                    {k}
                  </span>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="none" style={{ margin: 0 }}>
            No paths loaded.
          </p>
        )}
      </div>

      <p className="meta-line" style={{ marginTop: 12 }}>
        Key names and counts only. No value from Vault is ever returned by
        <code>/platform/identity</code>, so none can reach this page.
      </p>
    </div>
  );
}

/* ----------------------------------------------------------- database -- */

function DatabaseBlock({ database }: { database: DatabaseStatus }) {
  if (!database.enabled) {
    return (
      <div className="block">
        <h4>Database</h4>
        <p style={{ margin: '0 0 10px' }}>
          <span className="badge badge-neutral">no database</span>
        </p>
        <p style={{ margin: 0, fontSize: 13.5 }}>{database.note}</p>
      </div>
    );
  }

  const iam = database.authMethod === 'aws-iam-token';
  const session: SessionFacts | null = database.session;

  return (
    <div className="block">
      <h4>Database</h4>
      <p style={{ margin: '0 0 12px' }}>
        <span className={`badge ${iam ? 'badge-ok' : 'badge-warn'}`}>
          {database.authMethod}
        </span>{' '}
        <span className="meta-line">
          {iam
            ? 'a signed, short-lived token — there is no password to steal'
            : 'password authentication, which is local development only'}
        </span>
      </p>

      {database.error ? (
        <div className="callout callout-fail" style={{ marginBottom: 12 }}>
          <strong>The database did not answer.</strong>
          <pre className="error" style={{ marginTop: 8 }}>
            {database.error}
          </pre>
        </div>
      ) : null}

      <dl className="kv">
        <Row label="Host" value={database.host} mono />
        <Row label="Port" value={database.port} mono />
        <Row label="SSL mode" value={database.sslMode} mono />
        <Row label="Schema" value={database.schema} mono />
        <Row label="Current user" value={session?.currentUser} mono />
        <Row label="Session user" value={session?.sessionUser} mono />
        <Row label="Database" value={session?.database} mono />
        <Row label="Server version" value={session?.serverVersion} mono />
        <Row label="search_path" value={session?.searchPath} mono />
      </dl>
    </div>
  );
}

/* -------------------------------------------------------------- token -- */

function TokenBlock({ token }: { token: TokenInfo | null }) {
  return (
    <div className="block">
      <h4>IAM database token</h4>
      {token === null ? (
        <p className="none" style={{ margin: 0 }}>
          No token has been minted. Either this service has no database, or it
          authenticates with a password.
        </p>
      ) : (
        <>
          <TokenCountdown
            issuedAt={token.issuedAt}
            expiresAt={token.expiresAt}
            ttlSeconds={token.ttlSeconds}
          />
          <dl className="kv" style={{ marginTop: 14 }}>
            <Row label="Issued at" value={<code>{token.issuedAt}</code>} />
            <Row label="Expires at" value={<code>{token.expiresAt}</code>} />
            <Row label="Lifetime" value={`${token.ttlSeconds} seconds`} />
          </dl>
          <p className="meta-line" style={{ marginTop: 10 }}>
            Minted per connection by signing the endpoint with the pod’s IRSA
            credentials. When this reaches zero the next connection signs a new
            one; nothing is stored and nothing is rotated by hand.
          </p>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- tls -- */

function TlsBlock({ session }: { session: SessionFacts | null }) {
  if (!session) {
    return (
      <div className="block">
        <h4>TLS</h4>
        <p className="none" style={{ margin: 0 }}>
          No database session to describe.
        </p>
      </div>
    );
  }

  const { tls } = session;
  return (
    <div className="block">
      <h4>TLS</h4>
      <p style={{ margin: '0 0 12px' }}>
        <span className={`badge ${tls.ssl ? 'badge-ok' : 'badge-fail'}`}>
          {tls.ssl ? 'encrypted' : 'not encrypted'}
        </span>
      </p>
      <dl className="kv">
        <Row label="Protocol" value={tls.version} mono />
        <Row label="Cipher" value={tls.cipher} mono />
      </dl>
      <p className="meta-line" style={{ marginTop: 10 }}>
        From <code>pg_stat_ssl</code> for this backend’s own process ID — the
        server’s account of the connection, not the client’s.
      </p>
    </div>
  );
}

/* ---------------------------------------------------- no-password proof -- */

type CheckState = 'pass' | 'fail' | 'info';

function Check({
  state,
  title,
  note,
}: {
  state: CheckState;
  title: React.ReactNode;
  note?: React.ReactNode;
}) {
  const mark = state === 'pass' ? '✓' : state === 'fail' ? '!' : '?';
  return (
    <li className={`check check-${state}`}>
      <span className="check-icon" aria-hidden="true">
        {mark}
      </span>
      <span className="check-body">
        <strong>{title}</strong>
        {note ? <span className="check-note">{note}</span> : null}
      </span>
    </li>
  );
}

function NoPasswordBlock({
  proof,
  hasDatabase,
}: {
  proof: NoPasswordProof;
  hasDatabase: boolean;
}) {
  return (
    <div className="block">
      <h4>No-password proof</h4>
      <ul className="checklist">
        <Check
          state={proof.databasePasswordEnvPresent ? 'fail' : 'pass'}
          title={
            proof.databasePasswordEnvPresent
              ? 'DATABASE_PASSWORD is set in this process'
              : 'No DATABASE_PASSWORD in this process'
          }
          note={
            <>
              <code>databasePasswordEnvPresent</code> ={' '}
              {String(proof.databasePasswordEnvPresent)} — the environment was
              read at render time, not asserted.
            </>
          }
        />

        <Check
          state={proof.vaultKeysMatchingPassword.length === 0 ? 'pass' : 'fail'}
          title={
            proof.vaultKeysMatchingPassword.length === 0
              ? 'No Vault key that looks like a password'
              : `${proof.vaultKeysMatchingPassword.length} Vault key(s) look like a password`
          }
          note={
            proof.vaultKeysMatchingPassword.length === 0 ? (
              <>
                <code>vaultKeysMatchingPassword</code> = [] — every key name
                loaded from Vault was matched against{' '}
                <code>/password|passwd|pwd/i</code>.
              </>
            ) : (
              <>
                {proof.vaultKeysMatchingPassword.join(', ')} — someone
                reintroduced a credential this platform is supposed to have
                retired.
              </>
            )
          }
        />

        <Check
          state={
            proof.rdsIamGranted === true
              ? 'pass'
              : proof.rdsIamGranted === null
                ? 'info'
                : 'fail'
          }
          title={
            proof.rdsIamGranted === true
              ? 'The database role is a member of rds_iam'
              : proof.rdsIamGranted === null
                ? hasDatabase
                  ? 'rds_iam membership could not be read'
                  : 'Not applicable — this service has no database'
                : 'The database role is NOT a member of rds_iam'
          }
          note={
            <>
              <code>rdsIamGranted</code> = {String(proof.rdsIamGranted)} — read
              from <code>pg_auth_members</code>. Membership of{' '}
              <code>rds_iam</code> is what makes token authentication possible
              at all.
            </>
          }
        />

        <Check
          state={
            proof.roleHasPasswordSet === null
              ? 'info'
              : proof.roleHasPasswordSet
                ? 'fail'
                : 'pass'
          }
          title={
            proof.roleHasPasswordSet === null
              ? 'Password on the role: cannot be read (expected)'
              : proof.roleHasPasswordSet
                ? 'The role has a password set'
                : 'The role has no password set'
          }
          note={
            proof.roleHasPasswordSet === null ? (
              <>
                <code>roleHasPasswordSet</code> = null means the role cannot
                read <code>pg_authid</code>, which only a superuser can. This is
                expected and is <strong>not a failure</strong>. “Cannot see a
                password” is a weaker claim than “there is no password”, so it
                is reported as null rather than quietly upgraded — the{' '}
                <code>rds_iam</code> check above is the one that settles it.
              </>
            ) : (
              <>
                <code>roleHasPasswordSet</code> ={' '}
                {String(proof.roleHasPasswordSet)} — read from{' '}
                <code>pg_authid</code>.
              </>
            )
          }
        />
      </ul>
    </div>
  );
}

/* --------------------------------------------------------------- card -- */

export function ServiceCard({ report }: { report: ServiceReport }) {
  const { identity } = report;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>{report.name}</h3>
          <p className="meta-line" style={{ marginTop: 2 }}>
            {report.role}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {identity ? (
            <span className="badge badge-neutral">{identity.environment}</span>
          ) : null}
          <span className={`badge ${report.reachable ? 'badge-ok' : 'badge-fail'}`}>
            {report.reachable ? 'reachable' : 'unreachable'}
          </span>
        </div>
      </div>

      <div className="panel-body">
        <p className="meta-line" style={{ marginBottom: 16 }}>
          {report.upstreamUrl ? (
            <>
              {report.reachable ? 'Fetched' : 'Attempted'} server-side from{' '}
              <code>{report.upstreamUrl}</code>
              {report.reachable
                ? ` in ${report.durationMs} ms.`
                : `, gave up after ${report.durationMs} ms.`}
            </>
          ) : (
            <>Assembled in this process — this is the service you are talking to.</>
          )}
        </p>

        {identity === null ? (
          <div className="callout callout-fail">
            <p style={{ margin: '0 0 8px' }}>
              <strong>This service did not answer.</strong> The other cards are
              unaffected, which is the behaviour this page is built to have: a
              diagnostic tool that goes blank when something breaks is no use
              at the moment you need it.
            </p>
            <pre className="error">{report.error}</pre>
          </div>
        ) : (
          <>
            <div className="block-grid">
              <KubernetesBlock k8s={identity.kubernetes} />
              <AwsBlock aws={identity.aws} />
              <VaultBlock vault={identity.vault} />
              <DatabaseBlock database={identity.database} />
              <TokenBlock
                token={identity.database.enabled ? identity.database.token : null}
              />
              <TlsBlock
                session={identity.database.enabled ? identity.database.session : null}
              />
            </div>

            <div style={{ marginTop: 14 }}>
              <NoPasswordBlock
                proof={identity.noPasswordProof}
                hasDatabase={identity.database.enabled}
              />
            </div>

            <p className="meta-line" style={{ marginTop: 14 }}>
              Generated by {identity.service} at <code>{identity.generatedAt}</code>.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
