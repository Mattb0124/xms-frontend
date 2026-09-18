import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'XMS',
  description:
    'The XMS backend-for-frontend: the only public surface, and the proof page behind it.',
};

/**
 * No font package, no UI framework, no icon set. The dependency list is part
 * of the reference: a front end that fronts three services needs a router, a
 * renderer and an AWS client, and this one has exactly that.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="shell header-inner">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden="true" />
              <span className="brand-text">
                <strong>XMS</strong>
                <span className="brand-sub">backend-for-frontend</span>
              </span>
            </Link>
            <nav className="nav" aria-label="Primary">
              <Link href="/">Items</Link>
              <Link href="/platform">Platform proof</Link>
            </nav>
          </div>
        </header>

        <main className="shell page">{children}</main>

        <footer className="site-footer">
          <div className="shell">
            <p>
              xms-frontend · the only service on this platform with a public
              gateway. Everything it shows was fetched server-side over
              Kubernetes cluster DNS.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
