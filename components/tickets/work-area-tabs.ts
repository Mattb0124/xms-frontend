/**
 * The ticket record's work area tabs, in the prototype's order (Wireframes
 * section 3.2): Conversation, Activity, Time, Resolution, Links, Sync. Sync
 * is a rail card in the built record, and Email, which the prototype does
 * not carry, follows the five they share (frontend review finding 21).
 */
export interface WorkAreaTab {
  key: string;
  label: string;
}

export const WORK_AREA_TABS: WorkAreaTab[] = [
  { key: "conversation", label: "Conversation" },
  { key: "activity", label: "Activity" },
  { key: "time", label: "Time" },
  { key: "resolution", label: "Resolution" },
  { key: "links", label: "Links" },
  { key: "email", label: "Email" },
];
