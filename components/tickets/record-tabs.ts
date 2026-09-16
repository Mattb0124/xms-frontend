/**
 * The ticket record's two tab rows, laid out the ServiceNow way (Matt's
 * direction 2026-09-15 from the CSM case form the team works in today).
 *
 * The Notes card sits under the form and carries what a person writes on the
 * case: the conversation with its composer, and the closure information,
 * which ServiceNow's form names the same way. The Related lists card sits
 * under that and carries the lists that hang off the case, SLAs first, as
 * ServiceNow orders them, with the surfaces this build has and ServiceNow
 * does not (Solutions, Contract, Scope, Sync) after the ones both share.
 *
 * Email is a related list here rather than the thread's own metadata: it is
 * the delivery log, the inbound messages with their disposition and what
 * matched them and the outbound messages with their delivery state.
 */
export interface RecordTab {
  key: string;
  label: string;
}

export const NOTES_TABS: RecordTab[] = [
  { key: "notes", label: "Notes" },
  { key: "closure", label: "Closure information" },
];

export const RELATED_TABS: RecordTab[] = [
  { key: "slas", label: "SLAs" },
  { key: "time", label: "Time entries" },
  { key: "attachments", label: "Attachments" },
  { key: "links", label: "Related cases" },
  { key: "email", label: "Emails" },
  { key: "activity", label: "Activity" },
  { key: "solutions", label: "Solutions" },
  { key: "contract", label: "Contract" },
  { key: "scope", label: "Scope" },
  { key: "sync", label: "Sync" },
];
