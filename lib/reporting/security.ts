/**
 * The Security dashboard's rules (Audit & Analytics 7.1, XA-03): which
 * events each tile counts, what a paused or dead-letter row says beside its
 * name, and which screen a row opens.
 */
import { formatDay } from "@/lib/format/date";
import type { OpenDeadLetter, PausedIntegration, SecurityDashboard } from "@/redux/reportingApi";

type EventCount = SecurityDashboard["by_type"][number];

/** A permission, realm or account denial. */
export function isDenial(row: EventCount): boolean {
  return row.event_type.startsWith("authz.") && row.outcome === "denied";
}

export function isAdminChange(row: EventCount): boolean {
  return row.event_type.startsWith("admin.");
}

export function isDataEvent(row: EventCount): boolean {
  return row.event_type.startsWith("data.");
}

function sumWhere(data: SecurityDashboard, predicate: (row: EventCount) => boolean): number {
  return data.by_type.filter(predicate).reduce((total, row) => total + row.n, 0);
}

function total(rows: { n: number }[] | undefined): number {
  return (rows ?? []).reduce((sum, row) => sum + row.n, 0);
}

export interface SecurityTiles {
  signin: number;
  denials: number;
  probes: number;
  admin: number;
  exports: number;
  abuse: number;
  rateLimited: number;
  paused: number;
  quarantined: number;
  deadLetters: number;
}

/**
 * The figure on each tile. A block the API did not send totals zero here,
 * which is why the screen leaves that tile out rather than printing it: a
 * zero would read as "nothing happened", which is not what an older API said.
 */
export function securityTiles(data: SecurityDashboard): SecurityTiles {
  return {
    signin: sumWhere(data, (row) => row.event_type === "auth.signin.failed"),
    denials: sumWhere(data, isDenial),
    probes: total(data.isolation_probes),
    admin: sumWhere(data, isAdminChange),
    exports: sumWhere(
      data,
      (row) => row.event_type.startsWith("data.export") || row.event_type.startsWith("data.download"),
    ),
    // The abuse group as its own list where the API sends it, and the same
    // group counted out of by_type where it does not.
    abuse: data.abuse_by_kind
      ? total(data.abuse_by_kind)
      : sumWhere(data, (row) => row.event_type.startsWith("abuse.")),
    rateLimited: total(data.rate_limited_clients),
    // The tiles read the roll-ups the API sends beside the lists: the
    // paused count is by reason, and the dead-letter depth is the
    // operator-wide one per queue, which is deliberately wider than the
    // rows a reader bound to some accounts is shown.
    paused: total(data.paused_integrations_by_reason),
    quarantined: total(data.quarantined_attachments),
    deadLetters: total(data.open_dead_letters_by_queue),
  };
}

const PAUSED_KIND: Record<string, string> = {
  webhook_subscription: "Webhook subscription",
  connector_instance: "Connector instance",
};

export function pausedKindLabel(kind: string): string {
  return PAUSED_KIND[kind] ?? kind.replace(/_/g, " ");
}

/** A paused row is named by its record, or by its kind where the record has no name. */
export function pausedLabel(row: PausedIntegration): string {
  return row.name || pausedKindLabel(row.kind);
}

/**
 * What a paused row says beside its name: the kind, the account it is under
 * and the reason the server recorded. "unstated" is the server's own word
 * for a pause with no reason, and is left as it wrote it.
 */
export function pausedDetail(row: PausedIntegration): string {
  return [pausedKindLabel(row.kind), row.account_key, row.reason].filter(Boolean).join(", ");
}

/** The oldest failure and, for a connector queue, the instance it belongs to. */
export function deadLetterDetail(row: OpenDeadLetter): string {
  const oldest = `oldest ${formatDay(row.oldest)}`;
  return row.instance_name ? `${row.instance_name}, ${oldest}` : oldest;
}

/** The Admin screens these rows are answered on, each present only where the reader may open it. */
export interface SecurityLinks {
  apiClients?: string;
  connectors?: string;
  accounts?: string;
}

/**
 * A link the reader would be refused is worse than none, so each screen is
 * offered only with its permission in hand; the browser decides nothing
 * else here.
 */
export function securityLinks(hasPermission: (key: string) => boolean): SecurityLinks {
  return {
    apiClients: hasPermission("admin:api-clients") ? "/admin/api-clients" : undefined,
    connectors: hasPermission("admin:connectors") ? "/admin/connectors" : undefined,
    accounts: hasPermission("admin:accounts") ? "/admin/accounts" : undefined,
  };
}

/**
 * The API names the record behind each paused integration (backend
 * 77745ef), so a row opens the record rather than a list to go looking in: a
 * tripped instance opens its own connector page, and a paused webhook
 * subscription opens the account it belongs to, this application serving no
 * screen for a subscription the client registers itself. A row that names no
 * record carries no link: an address built from a missing id opens nothing
 * and says the row was addressable.
 */
export function pausedHref(row: PausedIntegration, links: SecurityLinks): string | undefined {
  if (row.kind === "connector_instance") {
    return links.connectors && row.id ? `${links.connectors}/${row.id}` : undefined;
  }
  return links.accounts && row.account_id ? `${links.accounts}/${row.account_id}` : undefined;
}

/**
 * The instance's own Dead letters tab, which is where the work is replayed
 * or discarded. A platform queue names no instance, and there is no screen
 * that replays it, so the row carries no link.
 */
export function deadLetterHref(row: OpenDeadLetter, links: SecurityLinks): string | undefined {
  return links.connectors && row.instance_id ? `${links.connectors}/${row.instance_id}?tab=dead-letters` : undefined;
}
