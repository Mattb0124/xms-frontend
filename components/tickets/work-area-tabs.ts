/**
 * The ticket record's work area tabs, in the render's order (Wireframes
 * section 3.2, v3 renders 02 to 07): Conversation, Activity, Time,
 * Resolution, Links, Sync. Sync used to be a rail card, which is not where
 * the render puts it. Email follows the six, because the built record has an
 * email surface the prototype does not carry and dropping the tab would drop
 * the surface.
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
  { key: "sync", label: "Sync" },
  { key: "email", label: "Email" },
];
