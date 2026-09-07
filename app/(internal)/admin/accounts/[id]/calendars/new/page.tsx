"use client";

import { useParams, useRouter } from "next/navigation";
import { CalendarEditor } from "@/components/admin/calendars/calendar-editor";
import { AdminGate, RecordBar } from "@/components/admin/primitives";
import { Skeleton } from "@/components/xms/skeleton";
import { useGetAccountQuery } from "@/redux/adminApi";

/** Registered as `admin.calendar.new`: the editor for a new calendar on one account. */
export default function NewCalendarPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data } = useGetAccountQuery(params.id);
  return (
    <AdminGate permission="admin:config">
      {data ? (
        <RecordBar backHref={`/admin/accounts/${params.id}`} backLabel={data.name} keyText={data.key} title="New calendar" />
      ) : (
        <Skeleton lines={1} className="mb-4 max-w-sm" />
      )}
      <CalendarEditor accountId={params.id} onCreated={(calendar) => router.push(`/admin/calendars/${calendar.id}`)} />
    </AdminGate>
  );
}
