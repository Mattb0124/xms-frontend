import type { AiCapability, RejectReason, WithheldReason } from "@/redux/aiApi";

/** Capability labels in desk vocabulary. */
export const CAPABILITY_LABEL: Record<AiCapability, string> = {
  classify: "Category",
  prioritise: "Priority",
  duplicate: "Possible duplicate",
  summarise: "Summary",
  draft_reply: "Draft reply",
  wsr_narrative: "Report narrative",
  time_entry: "Time entry",
  burn_anomaly: "Burn anomaly",
};

/** The reason a suggestion was withheld, in words that finish "Axel withheld this: ...". */
export function withheldReasonText(reason: WithheldReason | string | null | undefined): string {
  switch (reason) {
    case "below_threshold":
      return "confidence was below the account threshold";
    case "switch_off":
      return "AI is switched off for this account";
    case "capability_off":
      return "this capability is switched off for this account";
    case "residency":
      return "the account's residency requirement is not met";
    case "redaction_refused":
      return "the ticket text could not be redacted safely";
    case "unavailable":
      return "Axel is unavailable right now";
    case "no_content":
      return "there was not enough content to work from";
    case "schema_error":
      return "the answer did not match the expected shape";
    case "kill_switch":
      return "AI is switched off by the operator";
    default:
      return reason ? String(reason).replace(/_/g, " ") : "no reason was given";
  }
}

export function withheldLine(reason: WithheldReason | string | null | undefined): string {
  return `Axel withheld this: ${withheldReasonText(reason)}.`;
}

/** Why the request buttons are disabled when the account switch is not effective. */
export function switchOffTooltip(reason: "switch_off" | "residency" | "kill_switch" | undefined): string {
  switch (reason) {
    case "residency":
      return "AI is off for this account: the residency requirement is not met.";
    case "kill_switch":
      return "AI is switched off by the operator.";
    default:
      return "AI is switched off for this account.";
  }
}

export const REJECT_REASON_LABEL: Record<RejectReason, string> = {
  wrong: "Wrong",
  unnecessary: "Unnecessary",
  already_done: "Already done",
  unclear: "Unclear",
  other: "Other",
};

/** Copy for a decision that the API refused (409 and 403 codes from the technical spec). */
export function describeDecisionError(code: string, permission?: string): string {
  switch (code) {
    case "already_decided":
      return "Someone already decided this suggestion.";
    case "expired":
      return "This suggestion has expired.";
    case "target_state":
      return "Intake suggestions apply only before the ticket is assigned.";
    case "not_offered":
      return "This suggestion was withheld and cannot be applied.";
    case "forbidden":
      return permission ? `You need the ${permission} permission to decide this.` : "Not permitted.";
    case "applied_payload_required":
      return "Edit the suggestion before accepting it with changes.";
    case "invalid_payload":
      return "The edited values are not valid for this suggestion.";
    case "merge_target_required":
      return "Choose which ticket this one duplicates.";
    case "network":
      return "The API could not be reached.";
    default:
      return `The decision failed (${code}).`;
  }
}

/** Copy for the AI settings page's 400 codes. */
export function describeSettingsError(code: string, problems?: string[]): string {
  switch (code) {
    case "dpa_required":
      return "Enter the DPA reference before switching AI on.";
    case "residency_unsupported":
      return "The account's residency region is not served by the harness, so AI cannot be switched on.";
    case "invalid_capabilities":
      return problems?.length
        ? `Some capability settings are not valid: ${problems.join("; ")}`
        : "Some capability settings are not valid.";
    case "invalid_config":
      return problems?.length ? `The defaults are not valid: ${problems.join("; ")}` : "The defaults are not valid.";
    case "stale_version":
      return "Someone else changed these settings. They have been reloaded.";
    case "forbidden":
      return "You do not have permission to change these settings.";
    case "network":
      return "The API could not be reached.";
    default:
      return `The save failed (${code}).`;
  }
}

export function formatConfidence(value: number | null | undefined): string {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "n/a";
}
