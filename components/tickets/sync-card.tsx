"use client";

import { LinkStatePill, OutcomePill } from "@/components/admin/connectors/pills";
import { formatDate } from "@/components/admin/primitives";
import { RailCard } from "@/components/xms/rail-card";
import { pendingLabel } from "@/lib/connectors/outbound";
import { externalRecordUrl, modeLabel } from "@/lib/connectors/vocab";
import { EXTERNAL_REL } from "@/lib/safe-url";
import { useTicketSyncQuery, type SyncRun, type TicketSyncLink } from "@/redux/connectorsApi";

/** What the consultant must know about sending (ServiceNow Sync functional 5.3 and 5.5). */
export function modeNotice(link: TicketSyncLink): string | null {
  if (link.health === "tripped")
    return "Kill switch tripped: nothing is sent or applied; the ticket keeps working locally.";
  if (link.mode === "off") return "Sync is off for this instance.";
  if (link.mode === "ingest_only") return "Updates are not sent to ServiceNow.";
  return null;
}

/**
 * The last contest on this link, worded from the side that lost it: inbound,
 * ServiceNow moved a field XMS owns and XMS kept its value; outbound, the
 * push left fields behind because the instance owns them (functional 5.3 and
 * 5.5, SN-04). Policy resolves a conflict; the note records it.
 */
function ConflictNote({ link, inline }: { link: TicketSyncLink; inline?: boolean }) {
  const conflict = link.last_conflict;
  if (!conflict) return null;
  const fields = Array.isArray(conflict.fields) ? conflict.fields.map(String) : [];
  const named = fields.length > 0 ? fields.join(", ") : "a field";
  const when = conflict.at ? ` (${formatDate(String(conflict.at))})` : "";
  const outbound = conflict.direction === "out";
  return (
    <p
      // Inside the note block the sentence is part of what the block says, so
      // it takes the block's own type rather than a second tinted box inside
      // it (render 07 draws one block, one voice).
      className={
        inline
          ? "mt-2 text-[14px] leading-[1.6]"
          : "rounded-[4px] border border-[color:var(--state-needs-input-border)] bg-[color:var(--state-needs-input-bg)] px-2 py-1 text-[12px] text-[color:var(--state-needs-input-text)]"
      }
      data-conflict={fields.join(",")}
      data-conflict-direction={outbound ? "out" : "in"}
    >
      {outbound
        ? `The last push left ${named} behind${when}: ServiceNow owns ${fields.length === 1 ? "that field" : "those fields"}. XMS keeps its own value; the run log names both.`
        : `ServiceNow changed ${named} that XMS owns${when}. XMS kept its value; the run log names both.`}
    </p>
  );
}

/**
 * What has and has not reached this instance for this ticket (functional
 * 5.3). It stays on an instance dropped back to ingest only, because the
 * queued work stays too and the consultant is entitled to know it is waiting
 * (functional 5.7); it says nothing at all where there is nothing to say.
 */
function OutboundState({ link }: { link: TicketSyncLink }) {
  const outbound = link.outbound;
  if (!outbound) return null;
  const worthSaying =
    link.mode === "bidirectional" ||
    outbound.pending > 0 ||
    outbound.failed > 0 ||
    outbound.last_error !== null ||
    outbound.last_pushed_at !== null;
  if (!worthSaying) return null;
  return (
    <div className="flex flex-col gap-1" data-outbound-pending={outbound.pending}>
      <p className="xms-mono text-xms-label text-[11px]">
        last pushed {outbound.last_pushed_at ? formatDate(outbound.last_pushed_at) : "never"}
      </p>
      <p className={outbound.pending > 0 ? "text-xms-body text-[12px]" : "text-xms-label text-[12px]"}>
        {pendingLabel(outbound.pending)}
        {outbound.failed > 0 ? `, ${outbound.failed} failed` : ""}
      </p>
      {outbound.last_error ? (
        <p className="text-[12px] text-[color:var(--state-overdue-text)]" data-outbound-error>
          Last send error: {outbound.last_error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The external record number. It links to the client instance only when the
 * instance base URL is one we will navigate to; otherwise the number still
 * shows, as plain text (security review finding 26).
 */
function ExternalRecordLink({ link }: { link: TicketSyncLink }) {
  const href = externalRecordUrl(link.base_url, link.table_name, link.external_sys_id);
  if (href === null) {
    return (
      <span className="xms-mono text-xms-body text-[13px] font-medium" data-external={link.external_number}>
        {link.external_number}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel={EXTERNAL_REL}
      className="xms-mono text-xms-accent text-[13px] font-medium"
      data-external={link.external_number}
    >
      {link.external_number}
    </a>
  );
}

/**
 * The facts about one link, as render 07 sets them: a mono block, one fact a
 * line, on the quietest ground. They were scattered through the card at 11
 * and 12px between sentences, so the external number, the direction, the
 * last exchange and the kill switch each read as a different kind of thing.
 */
function LinkFacts({ link }: { link: TicketSyncLink }) {
  const lines = [
    `direction: ${modeLabel(link.mode).toLowerCase()}`,
    `last in ${link.last_inbound_at ? formatDate(link.last_inbound_at) : "never"} · last out ${
      link.last_outbound_at ? formatDate(link.last_outbound_at) : "never"
    }`,
    `instance ${link.instance_name}, health ${link.health}`,
    `kill switch ${link.health === "tripped" ? "tripped" : "armed, not tripped"}`,
  ];
  return (
    <div className="border-xms-line bg-xms-quiet-bg xms-mono text-xms-body rounded-[var(--xms-radius-card)] border p-4 text-[13px] leading-[1.9]">
      <p>
        {"external record: "}
        <ExternalRecordLink link={link} />
      </p>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

export function SyncCardView({
  links,
  runs,
  flush,
}: {
  links: TicketSyncLink[];
  runs: SyncRun[];
  /** Inside the Sync tab there is already a card, so the rail card is dropped. */
  flush?: boolean;
}) {
  if (links.length === 0) return null;
  // Render 07 draws the tab as two blocks: what a person needs to be told,
  // on the note ground, then the facts in mono. The rail keeps the compact
  // stack, because 262px has no room for either.
  if (flush) {
    return (
      <div className="flex flex-col gap-3">
        {links.map((link) => {
          const notice = modeNotice(link);
          return (
            <div key={`${link.instance_name}:${link.external_sys_id}`} className="flex flex-col gap-3">
              <div className="xms-note p-4 text-[14px] leading-[1.6]">
                <p>
                  {`Synced with ${link.instance_name}. `}
                  {notice ?? "Updates travel both ways; policy decides a conflict and the run log names both sides."}
                </p>
                <ConflictNote link={link} inline />
              </div>
              <LinkFacts link={link} />
              <OutboundState link={link} />
            </div>
          );
        })}
        {runs.length > 0 ? (
          <ul className="flex flex-col" aria-label="Recent runs">
            {runs.slice(0, 5).map((run) => (
              <li
                key={run.id}
                className="border-xms-line-row flex items-center gap-3 border-b py-[10px] text-[13px] last:border-b-0"
              >
                <span className="xms-mono text-xms-muted">{formatDate(run.created_at)}</span>
                <span className="text-xms-body flex-1">{run.direction}</span>
                <OutcomePill outcome={run.outcome} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  const body = (
    <div className="flex flex-col gap-3">
      {links.map((link) => {
        const notice = modeNotice(link);
        return (
          <div
            key={`${link.instance_name}:${link.external_sys_id}`}
            className="flex flex-col gap-1"
            data-link-state={link.state}
          >
            <div className="flex flex-wrap items-center gap-2">
              <ExternalRecordLink link={link} />
              <LinkStatePill state={link.state} />
            </div>
            <p className="text-xms-label text-[12px]">
              {link.instance_name}, {modeLabel(link.mode).toLowerCase()}, {link.health}
            </p>
            <p className="xms-mono text-xms-label text-[11px]">
              last in {link.last_inbound_at ? formatDate(link.last_inbound_at) : "never"}
              {link.last_outbound_at ? `, last out ${formatDate(link.last_outbound_at)}` : ""}
            </p>
            {notice ? (
              <p className="text-xms-body text-[12px]" data-notice>
                {notice}
              </p>
            ) : null}
            <OutboundState link={link} />
            <ConflictNote link={link} />
          </div>
        );
      })}
      {runs.length > 0 ? (
        <ul className="border-xms-line flex flex-col gap-1 border-t pt-2" aria-label="Recent runs">
          {runs.slice(0, 5).map((run) => (
            <li key={run.id} className="flex items-center gap-2 text-[12px]">
              <span className="xms-mono text-xms-label">{formatDate(run.created_at)}</span>
              <span className="text-xms-body">{run.direction}</span>
              <OutcomePill outcome={run.outcome} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
  return flush ? body : <RailCard caption="Sync">{body}</RailCard>;
}

/** The rail's Sync card: nothing renders until the ticket has a link (User Experience 3.4, Sync). */
export function SyncCard({ ticketId, flush }: { ticketId: string; flush?: boolean }) {
  const { data } = useTicketSyncQuery(ticketId);
  if (!data || data.links.length === 0)
    return flush ? (
      <p className="text-xms-label text-[13px]">This ticket is not linked to an external record.</p>
    ) : null;
  return <SyncCardView links={data.links} runs={data.runs} flush={flush} />;
}
