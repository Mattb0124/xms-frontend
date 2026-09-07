/**
 * Internal application root. Lands on My work once P1.4.1 (shell) and P1.5.5
 * (queue and record) ship; until then this page proves the token layers.
 * Reference: 01-architecture/USER-EXPERIENCE.md section 3.1, Wireframes v2 section 3.3.
 */
export default function InternalHomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="xms-caption">XMS · Internal</p>
          <h1 className="text-xms-ink mt-1 text-[22px] font-semibold">My work</h1>
        </div>
        <span className="xms-mono text-xms-muted text-xs">day 1 scaffold</span>
      </header>

      <section className="xms-card p-4">
        <p className="xms-caption mb-3">Token check</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="xms-state" data-state="new">New</span>
          <span className="xms-state" data-state="in-progress">In progress</span>
          <span className="xms-state" data-state="awaiting-client">Awaiting client</span>
          <span className="xms-state" data-state="awaiting-approval">Awaiting approval</span>
          <span className="xms-state" data-state="resolved">Resolved</span>
          <span className="xms-state" data-state="closed">Closed</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6 text-[13px]">
          <span className="xms-type" data-type="incident">Incident</span>
          <span className="xms-type" data-type="request">Request</span>
          <span className="xms-type" data-type="change">Change</span>
          <span className="xms-type" data-type="problem">Problem</span>
          <span className="xms-account" data-hue="1">Brookfield UK</span>
          <span className="xms-account" data-hue="3">Kestrel Retail</span>
          <span className="aix-state-pill" data-state="overdue">Breached</span>
          <span className="xms-mono text-xms-accent">CS0001204</span>
        </div>
      </section>

      <section className="xms-ai p-4 text-[13px]">
        <p className="xms-caption mb-1">Axel summary</p>
        AI-origin content renders on the violet family and nowhere else.
      </section>
    </main>
  );
}
