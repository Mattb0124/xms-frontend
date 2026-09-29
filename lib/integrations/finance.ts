import type { SignalTone } from "@/components/xms/signal-pill";
import { apiError, describeError, type ApiError } from "@/lib/admin/api-error";
import type { BillingStatus } from "@/redux/timeApi";
import type {
  DestinationKind,
  FinanceDelivery,
  FinanceDeliveryStatus,
  FinanceDestination,
  FinanceFormat,
  SetDestinationBody,
} from "@/redux/integrationsApi";

/**
 * The finance connector vocabulary (Integrations functional 5.3, INT-02):
 * the destination kinds and formats, the five delivery states, the draft the
 * destination form keeps, the body the API takes per kind, and the refusals
 * in words. The server owns every value shown; nothing is recomputed here.
 */
export const DESTINATION_KINDS: Record<DestinationKind, { label: string; detail: string }> = {
  https: { label: "HTTPS endpoint", detail: "Signed posts to an endpoint finance exposes" },
  object_store: { label: "Object store", detail: "Objects written under a prefix finance reads" },
};

export const FINANCE_FORMATS: Record<FinanceFormat, string> = { csv: "CSV", xlsx: "Excel" };

export const DELIVERY_STATUS: Record<FinanceDeliveryStatus, { label: string; tone: SignalTone }> = {
  pending: { label: "Pending", tone: "needs-input" },
  delivered: { label: "Delivered", tone: "ready" },
  acknowledged: { label: "Acknowledged", tone: "complete" },
  failed: { label: "Failed", tone: "overdue" },
  superseded: { label: "Superseded", tone: "blocked" },
};

/** A period is deliverable once it is locked; a re-lock supersedes the earlier delivery. */
export const DELIVERABLE_STATUSES: BillingStatus[] = ["locked", "exported"];

export function isDeliverable(status: BillingStatus): boolean {
  return DELIVERABLE_STATUSES.includes(status);
}

export interface DestinationDraft {
  kind: DestinationKind;
  endpointUrl: string;
  objectPrefix: string;
  format: FinanceFormat;
  enabled: boolean;
}

export const emptyDestinationDraft: DestinationDraft = {
  kind: "https",
  endpointUrl: "",
  objectPrefix: "",
  format: "csv",
  enabled: true,
};

export function draftFromDestination(destination: FinanceDestination | null | undefined): DestinationDraft {
  if (!destination) return emptyDestinationDraft;
  return {
    kind: destination.kind,
    endpointUrl: destination.endpoint_url ?? "",
    objectPrefix: destination.object_prefix ?? "",
    format: destination.format,
    enabled: destination.enabled,
  };
}

/** Only the fields the chosen kind owns are sent; the other one is left out. */
export function destinationBody(draft: DestinationDraft): SetDestinationBody {
  return {
    kind: draft.kind,
    ...(draft.kind === "https" ? { endpoint_url: draft.endpointUrl.trim() } : {}),
    ...(draft.kind === "object_store" ? { object_prefix: draft.objectPrefix.trim() } : {}),
    format: draft.format,
    enabled: draft.enabled,
  };
}

/** The signing key changes when the endpoint does, so the form says which one is in force. */
export function secretKidLabel(destination: FinanceDestination | null | undefined): string {
  if (!destination || destination.kind !== "https") return "";
  return destination.secret_kid ? `Signing key ${destination.secret_kid}` : "No signing key yet";
}

export function responseStatusLabel(delivery: FinanceDelivery): string {
  return delivery.response_status === null ? "" : `HTTP ${delivery.response_status}`;
}

export function acknowledgementLabel(delivery: FinanceDelivery): string {
  if (!delivery.ack_received_at) return "Not acknowledged";
  const when = delivery.ack_received_at.slice(0, 16).replace("T", " ");
  return delivery.ack_reference ? `${delivery.ack_reference} on ${when}` : `Acknowledged ${when}`;
}

export interface FinanceError extends ApiError {
  /** invalid_endpoint names the problem with the URL. */
  problem?: string;
  /** period_not_locked carries the period's status. */
  periodStatus?: string;
}

export function financeError(error: unknown): FinanceError {
  const parsed = apiError(error) as FinanceError;
  const data = (error as { data?: Record<string, unknown> })?.data;
  if (data && typeof data === "object") {
    if (typeof data.problem === "string") parsed.problem = data.problem;
    if (typeof data.status === "string") parsed.periodStatus = data.status;
  }
  return parsed;
}

const ENDPOINT_PROBLEMS: Record<string, string> = {
  invalid_url: "that is not a URL the API can read, and it must carry no user name or password.",
  not_https: "the endpoint must be an https address.",
  private_host: "the endpoint must be reachable on the public internet, not a private address.",
};

export function describeFinanceError(error: FinanceError): string {
  switch (error.code) {
    case "invalid_endpoint":
      return `The endpoint was refused: ${
        ENDPOINT_PROBLEMS[error.problem ?? ""] ?? "the API would not accept that address."
      }`;
    case "endpoint_required":
      return "An HTTPS destination needs an endpoint URL.";
    case "prefix_required":
      return "An object store destination needs a prefix.";
    case "period_not_locked":
      return error.periodStatus
        ? `That period is ${error.periodStatus} and is delivered once it is locked.`
        : "A period is delivered once it is locked.";
    case "no_destination":
      return "This account has no enabled destination. Set one above, then deliver.";
    case "not_found":
      return "That account or period is no longer yours to deliver.";
    default:
      return describeError(error);
  }
}
