"use client";

import { HolidayLibraries } from "@/components/admin/calendars/holiday-libraries";
import { AdminGate } from "@/components/admin/primitives";

/** Registered as `admin.holiday_calendars`: list and create the shared holiday libraries. */
export default function HolidayCalendarsPage() {
  return (
    <AdminGate permission="admin:config">
      <HolidayLibraries />
    </AdminGate>
  );
}
