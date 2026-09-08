"use client";

import { useParams } from "next/navigation";
import { CalendarEditor } from "@/components/admin/calendars/calendar-editor";
import { PreviewPanel } from "@/components/admin/calendars/preview-panel";
import { AdminGate, RecordBar } from "@/components/admin/primitives";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Skeleton } from "@/components/xms/skeleton";
import { useGetAccountQuery } from "@/redux/adminApi";
import { useGetCalendarQuery } from "@/redux/calendarsApi";
import { useMe } from "@/redux/me";

/**
 * The screen itself, mounted only once the reader holds the permission,
 * so the queries below are never sent by someone the API would refuse
 * (review finding 25).
 */
function CalendarRecordPageBody() {
  const params = useParams<{ id: string }>();
  const me = useMe();
  const { data, isLoading, isError, refetch } = useGetCalendarQuery(params.id);
  const account = useGetAccountQuery(data?.account_id ?? "", {
    skip: !data || !me.hasPermission("admin:accounts"),
  });
  return (
    <>
      {isLoading ? <Skeleton lines={2} className="mb-4 max-w-sm" /> : null}
      {!isLoading && (isError || !data) ? (
        <EmptyBanner
          title="This calendar is not on your accounts"
          action={{ label: "Back to Admin", href: "/admin" }}
        />
      ) : null}
      {data ? (
        <>
          <RecordBar
            backHref={`/admin/accounts/${data.account_id}`}
            backLabel={account.data?.name ?? "Account"}
            keyText={account.data?.key}
            title={data.name}
          />
          <div className="flex flex-col gap-4">
            <CalendarEditor accountId={data.account_id} calendar={data} refetch={refetch} />
            <div className="max-w-xl">
              <PreviewPanel calendarId={data.id} timeZone={data.time_zone} />
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

/** Registered as `admin.calendar`: one calendar's editor with the preview panel. */
export default function CalendarRecordPage() {
  return (
    <AdminGate permission="admin:config">
      <CalendarRecordPageBody />
    </AdminGate>
  );
}
