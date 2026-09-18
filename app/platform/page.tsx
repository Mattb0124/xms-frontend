import type { Metadata } from 'next';
import Link from 'next/link';
import { collectPlatformSnapshot } from '@/lib/platform';
import { toPublicSnapshot, type Guarantee, type Verdict } from '@/lib/public-view';
import { TokenCountdown } from './token-countdown';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'How this platform protects itself · XMS',
  description:
    'Six security guarantees, each checked live against the running system.',
};

/**
 * The proof page.
 *
 * It answers one question — "is this platform actually doing what it claims?"
 * — and it answers it in a form a reader can judge without knowing the stack.
 * Each guarantee is a plain claim, a verdict, and the evidence behind it.
 *
 * Everything shown is derived server-side by lib/public-view.ts, which drops
 * the identifiers and keeps the properties. This page is public and
 * unauthenticated, so it describes the shape of the system and never its
 * address book.
 */

const MARK: Record<Verdict, { glyph: string; label: string; cls: string }> = {
  pass: { glyph: '✓', label: 'Verified', cls: 'v-pass' },
  fail: { glyph: '✕', label: 'Not verified', cls: 'v-fail' },
  unknown: { glyph: '?', label: 'Unknown', cls: 'v-unknown' },
  'not-applicable': { glyph: '–', label: 'Not applicable', cls: 'v-na' },
};

function GuaranteeCard({ g, index }: { g: Guarantee; index: number }) {
  const m = MARK[g.verdict];
  return (
    <article className={`guarantee ${m.cls}`}>
      <header className="guarantee-head">
        <span className="guarantee-num" aria-hidden="true">
          {index}
        </span>
        <h3>{g.title}</h3>
        <span className="verdict" title={m.label}>
          <span aria-hidden="true">{m.glyph}</span>
          <span className="verdict-text">{m.label}</span>
        </span>
      </header>

      <p className="guarantee-matters">{g.matters}</p>
      <p className="guarantee-summary">{g.summary}</p>

      <details className="guarantee-more">
        <summary>How we know</summary>
        <ul className="evidence">
          {g.evidence.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
        <p className="method">{g.method}</p>
      </details>
    </article>
  );
}

export default async function PlatformPage() {
  const snapshot = toPublicSnapshot(await collectPlatformSnapshot());
  const allPass = snapshot.passing === snapshot.checked;
  const withToken = snapshot.services.find((s) => s.tokenExpiresAt);

  return (
    <main className="page proof">
      <header className="proof-hero">
        <p className="eyebrow">{snapshot.environment} environment · checked just now</p>
        <h1>How this platform protects itself</h1>
        <p className="lede">
          Six promises the XMS platform makes about how its services prove who
          they are, where their settings come from, and how they reach the
          database. Each one was checked against the running system when you
          loaded this page. Nothing below is copied from a document.
        </p>

        <div className={`scorecard ${allPass ? 'all-pass' : 'some-fail'}`}>
          <div className="score">
            <strong>{snapshot.passing}</strong>
            <span>of {snapshot.checked}</span>
          </div>
          <div className="score-text">
            <p className="score-headline">
              {allPass ? 'All checks passed' : 'Some checks did not pass'}
            </p>
            <p className="score-sub">
              {snapshot.upstreamsAnswered} of {snapshot.upstreamsTotal} internal
              services answered. Re-load to run the checks again.
            </p>
          </div>
        </div>
      </header>

      <section className="guarantees" aria-label="Guarantees">
        {snapshot.guarantees.map((g, i) => (
          <GuaranteeCard key={g.id} g={g} index={i + 1} />
        ))}
      </section>

      {withToken?.tokenIssuedAt && withToken.tokenExpiresAt && (
        <section className="panel token-panel">
          <h2>The database credential expires while you watch</h2>
          <p>
            This is the strongest single piece of evidence on the page. There is
            no database password. A service asks the cloud provider for
            permission to connect, gets something that works for fifteen
            minutes, and asks again next time. Nothing is stored, so nothing can
            be stolen or has to be rotated.
          </p>
          <TokenCountdown
            issuedAt={withToken.tokenIssuedAt}
            expiresAt={withToken.tokenExpiresAt}
          />
        </section>
      )}

      <section className="panel">
        <h2>The four services</h2>
        <p className="panel-lede">
          One is published. The rest exist only inside the cluster. The code
          column is a digest of each service’s cloud identity — different codes
          mean genuinely different identities, and the code itself reveals
          nothing.
        </p>

        <div className="table-scroll">
          <table className="svc-table">
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col">Reachable from</th>
                <th scope="col">Identity</th>
                <th scope="col">Settings loaded</th>
                <th scope="col">Database sign-in</th>
                <th scope="col">Encryption</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.services.map((s) => (
                <tr key={s.name} className={s.reachable ? '' : 'row-down'}>
                  <th scope="row">
                    <span className="svc-name">{s.name}</span>
                    <span className="svc-role">{s.role}</span>
                  </th>
                  <td>
                    {s.publiclyReachable ? (
                      <span className="pill pill-warn">the internet</span>
                    ) : (
                      <span className="pill pill-ok">inside the cluster only</span>
                    )}
                  </td>
                  <td>
                    {s.identityFingerprint ? (
                      <>
                        <code className="fp">{s.identityFingerprint}</code>
                        {s.identityFromWebToken && (
                          <span className="sub">no stored key</span>
                        )}
                      </>
                    ) : (
                      <span className="sub">—</span>
                    )}
                  </td>
                  <td>
                    {s.vaultKeyCount === null ? (
                      <span className="sub">none needed</span>
                    ) : (
                      <>
                        {s.vaultKeyCount} values
                        <span className="sub">
                          from {s.vaultPathCount} locations
                        </span>
                      </>
                    )}
                  </td>
                  <td>
                    {s.databaseAuth === 'iam-token' && (
                      <span className="pill pill-ok">15-minute token</span>
                    )}
                    {s.databaseAuth === 'password' && (
                      <span className="pill pill-fail">password</span>
                    )}
                    {s.databaseAuth === 'none' && (
                      <span className="sub">no database</span>
                    )}
                    {s.databaseAuth === 'unknown' && <span className="sub">—</span>}
                  </td>
                  <td>
                    {s.tlsVersion ? (
                      <>
                        {s.tlsVersion}
                        <span className="sub">server verified</span>
                      </>
                    ) : (
                      <span className="sub">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel withheld">
        <h2>What this page deliberately does not show</h2>
        <p>
          This page is public and needs no sign-in, so it describes how the
          system behaves without describing how to find it. These are left out
          on purpose, not by omission:
        </p>
        <ul>
          {snapshot.withheld.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        <p className="fine">
          The redaction happens on the server, in one place, so the{' '}
          <Link href="/api/platform">JSON version of this page</Link> is
          filtered by exactly the same code and cannot drift from what you see
          here.
        </p>
      </section>

      <footer className="proof-foot">
        <p>
          Generated {new Date(snapshot.generatedAt).toISOString()} ·{' '}
          <Link href="/">Back to the demo app</Link>
        </p>
      </footer>
    </main>
  );
}
