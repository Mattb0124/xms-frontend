/**
 * The ticket record's work area tabs, in the render's order (Wireframes
 * section 3.2, v3 renders 02 to 07): Conversation, Activity, Time,
 * Resolution, Links, Sync. Sync used to be a rail card, which is not where
 * the render puts it.
 *
 * Email follows those six, deliberately outside the adopted set. The spec
 * fixes the work area at six (USER-EXPERIENCE 3.4, WIREFRAMES line 102) and
 * places email there only as metadata inside Conversation, which the thread
 * already draws. This tab is not that metadata: it is the delivery log, the
 * inbound messages with their disposition and what matched them and the
 * outbound messages with their delivery state, bounces included. The spec
 * gives that surface no other home and the record needs it.
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
