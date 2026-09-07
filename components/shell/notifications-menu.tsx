"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  useListNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  type NotificationRow,
} from "@/redux/ticketsApi";

function relative(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export interface NotificationsMenuProps {
  onClose: () => void;
}

/** The bell dropdown: the latest 20 rows; a click marks read and follows the link; Mark all read. */
export function NotificationsMenu({ onClose }: NotificationsMenuProps) {
  const router = useRouter();
  const { data, isLoading } = useListNotificationsQuery({ limit: 20 });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAll] = useMarkAllNotificationsReadMutation();
  const open = (row: NotificationRow) => {
    if (!row.read_at) void markRead(row.id);
    onClose();
    if (row.link) router.push(row.link);
  };
  return (
    <div
      role="dialog"
      aria-label="Notifications"
      className="xms-card text-xms-ink absolute top-full right-4 z-30 mt-1 w-[360px] text-[13px]"
    >
      <header className="border-xms-line flex items-center gap-2 border-b px-3 py-2">
        <span className="font-semibold">Notifications</span>
        <button
          type="button"
          onClick={() => void markAll()}
          className="text-xms-accent ml-auto text-[12px] hover:underline"
        >
          Mark all read
        </button>
      </header>
      <ul className="max-h-[420px] overflow-auto">
        {isLoading ? <li className="text-xms-label px-3 py-2">Loading</li> : null}
        {(data ?? []).map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => open(row)}
              data-read={row.read_at ? "true" : "false"}
              className={cn(
                "border-xms-line hover:bg-xms-row-hover flex w-full flex-col gap-0.5 border-b px-3 py-2 text-left",
                !row.read_at && "bg-xms-tint",
              )}
            >
              <span className="flex items-center gap-2">
                <span className={cn("truncate", !row.read_at && "font-medium")}>{row.title}</span>
                {row.count > 1 ? (
                  <span className="xms-mono bg-xms-accent-tint text-xms-accent rounded-[999px] px-1.5 text-[10px]">
                    ×{row.count}
                  </span>
                ) : null}
                <span className="xms-mono text-xms-label ml-auto text-[11px]">{relative(row.updated_at)}</span>
              </span>
              {row.body ? <span className="text-xms-label truncate text-[12px]">{row.body}</span> : null}
            </button>
          </li>
        ))}
        {data && data.length === 0 ? <li className="text-xms-label px-3 py-3">Nothing new.</li> : null}
      </ul>
    </div>
  );
}
