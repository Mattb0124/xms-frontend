/**
 * Client-facing vocabulary (Client Portal functional spec section 5.1).
 * Internal state names never reach the portal: the seven client statuses
 * are a display mapping over the state machine, and the ramp colour comes
 * from the same mapping the desk uses so both surfaces agree.
 */
export type ClientStatus =
  "Submitted" | "Being worked" | "Waiting on you" | "Waiting on third party" | "Resolved" | "Closed" | "Cancelled";

export function clientStatus(state: string): ClientStatus {
  switch (state) {
    case "new":
      return "Submitted";
    case "awaiting_client":
      return "Waiting on you";
    case "awaiting_third_party":
    case "blocked":
      return "Waiting on third party";
    case "resolved":
    case "fulfilled":
    case "completed":
    case "done":
      return "Resolved";
    case "closed":
      return "Closed";
    case "cancelled":
    case "rejected":
      return "Cancelled";
    default:
      return "Being worked";
  }
}

export const PORTAL_TYPES: { value: "incident" | "service_request"; label: string; hint: string }[] = [
  { value: "incident", label: "Something is broken", hint: "An error, an outage or a result that is wrong." },
  { value: "service_request", label: "I need something", hint: "A change, an access, a report or a question." },
];

export const IMPACT_OPTIONS: { value: "high" | "medium" | "low"; label: string; hint: string }[] = [
  { value: "high", label: "High", hint: "Many people or a critical process are affected." },
  { value: "medium", label: "Medium", hint: "A team or a regular process is affected." },
  { value: "low", label: "Low", hint: "One person, or there is an easy workaround." },
];

export const URGENCY_OPTIONS: { value: "high" | "medium" | "low"; label: string; hint: string }[] = [
  { value: "high", label: "High", hint: "Needed today; a deadline depends on it." },
  { value: "medium", label: "Medium", hint: "Needed this week." },
  { value: "low", label: "Low", hint: "Whenever it fits." },
];

export function priorityLabel(priority: string): string {
  switch (priority) {
    case "p1":
      return "Critical";
    case "p2":
      return "High";
    case "p3":
      return "Normal";
    default:
      return "Low";
  }
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Terminal client statuses close the composer. */
export function isTerminal(state: string): boolean {
  return ["closed", "cancelled", "rejected"].includes(state);
}
