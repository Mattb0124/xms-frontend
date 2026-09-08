"use client";

import { AdminGate } from "@/components/admin/primitives";
import { ChangeCalendarScreen } from "@/components/tickets/change-calendar";

/**
 * The change calendar (`/tickets/change-calendar`, TM-18). Both
 * `GET /v1/change-calendar` and `GET /v1/change-calendar/at` stand on
 * `tickets:view`, so that is the gate, and the screen writes nothing.
 */
export default function ChangeCalendarPage() {
  return (
    <AdminGate permission="tickets:view">
      <ChangeCalendarScreen />
    </AdminGate>
  );
}
