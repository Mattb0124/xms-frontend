import { KeyText } from "@/components/xms/key-link";
import { Panel } from "@/components/xms/panel";
import { DEPLOY_TARGET, IS_LOCAL_TARGET } from "@/lib/auth/dev-mode";

/**
 * Token check page (moved from the internal root when the shell landed).
 * Proves the four token layers render in both themes.
 * Reference: 01-architecture/DESIGN-SYSTEM.md section 8, Wireframes section 8.
 *
 * A /dev page is a developer's tool, so it exists only on the local deploy
 * target (security review finding 27); anywhere else it says so and renders
 * nothing of itself.
 */
export default function TokensPage() {
  if (!IS_LOCAL_TARGET) {
    return (
      <Panel title="Token check" caption="Not available">
        <p className="text-xms-body text-[13px]">
          The developer pages run only on the local deploy target. This build names{" "}
          <code className="xms-mono">{DEPLOY_TARGET}</code>.
        </p>
      </Panel>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="xms-caption">XMS · Internal</p>
          <h1 className="text-xms-ink mt-1 text-[22px] font-semibold">Token check</h1>
        </div>
        <span className="xms-mono text-xms-muted text-xs">P1.1.3</span>
      </header>

      <section className="xms-card p-4">
        <p className="xms-caption mb-3">State ramp</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="xms-state" data-state="new">
            New
          </span>
          <span className="xms-state" data-state="in-progress">
            In progress
          </span>
          <span className="xms-state" data-state="awaiting-client">
            Awaiting client
          </span>
          <span className="xms-state" data-state="awaiting-approval">
            Awaiting approval
          </span>
          <span className="xms-state" data-state="resolved">
            Resolved
          </span>
          <span className="xms-state" data-state="closed">
            Closed
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6 text-[13px]">
          <span className="xms-type" data-type="incident">
            Incident
          </span>
          <span className="xms-type" data-type="request">
            Request
          </span>
          <span className="xms-type" data-type="change">
            Change
          </span>
          <span className="xms-type" data-type="problem">
            Problem
          </span>
          <span className="xms-account" data-hue="1">
            Brookfield UK
          </span>
          <span className="xms-account" data-hue="3">
            Kestrel Retail
          </span>
          <span className="aix-state-pill" data-state="overdue">
            Breached
          </span>
          <KeyText ticketKey="CS0001204" />
        </div>
      </section>

      <section className="xms-ai p-4 text-[13px]">
        <p className="xms-caption mb-1">Axel summary</p>
        AI-origin content renders on the violet family and nowhere else.
      </section>
    </div>
  );
}
