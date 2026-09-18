import { collectPlatformSnapshot } from '@/lib/platform';
import { config } from '@/lib/config';
import { ServiceCard } from './service-card';

/**
 * The proof page.
 *
 * It is the reason this repository exists. Every claim the platform makes
 * about itself — that pods get their AWS identity from IRSA, that secrets
 * come from Vault and never appear in an image, that Aurora is reached with a
 * short-lived IAM token over verified TLS and that no database password
 * exists anywhere — is rendered here from values read live by the services
 * themselves, at the moment you loaded the page.
 *
 * It is also a demonstration of the backend-for-frontend pattern, because of
 * how it is assembled: your browser made one request, to this origin. This
 * server made the other three, over addresses your browser cannot resolve.
 */

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Platform proof · XMS',
};

export default async function PlatformPage() {
  const cfg = config();
  const snapshot = await collectPlatformSnapshot();

  const upstreams = snapshot.services.filter((s) => s.upstreamUrl !== null);
  const reachable = upstreams.filter((s) => s.reachable).length;

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">{snapshot.environment} · live</span>
        <h1>Platform proof</h1>
        <p>
          One card per service in the XMS namespace. Every value below was read
          by that service from the thing it describes — STS for the AWS
          identity, Vault’s own response for the secret inventory, the Postgres
          catalogue and <code>pg_stat_ssl</code> for the database session.
          Nothing is repeated from a configuration file, because configuration
          is what this page is trying to verify.
        </p>
      </div>

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h2>How this page was produced</h2>
          <span className="badge badge-neutral">
            {reachable}/{upstreams.length} upstreams answered
          </span>
        </div>
        <div className="panel-body">
          <ol className="trail">
            <li>
              Your browser made <strong>exactly one request</strong>, to this
              origin: <code>GET /platform</code>. It made no others, to any
              host, for any of the data below.
            </li>
            <li>
              This server then called each internal service over Kubernetes
              cluster DNS, concurrently:
              <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                <li>
                  <code>{cfg.upstreams.backend.url}/platform/identity</code>
                </li>
                <li>
                  <code>{cfg.upstreams.worker.url}/platform/identity</code>
                </li>
                <li>
                  <code>{cfg.upstreams.mcp.url}/platform/identity</code>
                </li>
              </ul>
            </li>
            <li>
              Those addresses are <strong>not resolvable from a browser</strong>
              . They are <code>ClusterIP</code> Services with no public gateway
              and no public DNS record; the names only mean anything to a
              process whose resolver is the cluster’s. Paste one into a browser
              on any network, including the VPN, and it will not connect.
            </li>
            <li>
              The replies were merged into one document and rendered to HTML
              here. The same document is available as JSON at{' '}
              <a href="/api/platform">
                <code>/api/platform</code>
              </a>{' '}
              — still from this origin, still assembled server-side.
            </li>
            <li>
              Only one fragment of this page is client-side: the token
              countdown, which receives two timestamps and nothing else. No
              upstream address, credential or service name is present in the
              JavaScript bundle.
            </li>
          </ol>
        </div>
      </section>

      {snapshot.services.map((report) => (
        <div key={report.name} style={{ marginBottom: 20 }}>
          <ServiceCard report={report} />
        </div>
      ))}

      <p className="meta-line">
        Snapshot assembled by {snapshot.assembledBy} at{' '}
        <code>{snapshot.generatedAt}</code>. Nothing on this page is cached —
        reload it and every timestamp moves.
      </p>
    </>
  );
}
