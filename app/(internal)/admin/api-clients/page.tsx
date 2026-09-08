"use client";

import { ApiClientsView } from "@/components/admin/api-clients/api-clients-view";
import { AdminGate } from "@/components/admin/primitives";

/**
 * Registered as `admin.api_clients`: the API clients list, the New client
 * form over the server's scope catalog and the viewer's granted accounts,
 * the key shown once, and Revoke behind a confirm.
 */
export default function AdminApiClientsPage() {
  return (
    <AdminGate permission="admin:api-clients">
      <ApiClientsView />
    </AdminGate>
  );
}
