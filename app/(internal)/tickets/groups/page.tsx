"use client";

import { AdminGate } from "@/components/admin/primitives";
import { TicketGroupsCatalog } from "@/components/tickets/ticket-groups";

/**
 * The groups catalog (`/tickets/groups`, TM-10): the projects and change
 * windows a ticket tree belongs to. `GET /v1/ticket-groups` stands on
 * `tickets:view`, so that is the gate; the create and edit controls inside
 * ask for `tickets:work`, which the API requires for the writes.
 */
export default function TicketGroupsPage() {
  return (
    <AdminGate permission="tickets:view">
      <TicketGroupsCatalog />
    </AdminGate>
  );
}
