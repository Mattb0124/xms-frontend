'use client';

/**
 * The error boundary, and the reason the rest of this codebase is allowed to
 * throw freely.
 *
 * Failing loudly is only useful if something catches the noise and shows it.
 * That is this file's whole job — and note what it does not do: it does not
 * render an empty list, a zero, or a page that looks fine. A reader can tell
 * at a glance that nothing was rendered because something was wrong.
 *
 * In production Next.js replaces a server error's message with a digest
 * before it reaches the browser, so the full text lives in the pod logs. The
 * digest below is the key that finds it.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>This page did not render</h2>
        <span className="badge badge-fail">error</span>
      </div>
      <div className="panel-body">
        <p style={{ marginTop: 0 }}>
          Something this service depends on failed. Nothing has been guessed at
          or substituted, which is why you are looking at this instead of a
          page with missing data in it.
        </p>
        <pre className="error">{error.message}</pre>
        {error.digest ? (
          <p className="meta-line" style={{ marginTop: 12 }}>
            Digest <code>{error.digest}</code> — search the pod logs for it to
            get the full server-side stack.
          </p>
        ) : null}
        <p style={{ marginBottom: 0, marginTop: 16 }}>
          <button className="primary" type="button" onClick={reset}>
            Try again
          </button>
        </p>
      </div>
    </section>
  );
}
