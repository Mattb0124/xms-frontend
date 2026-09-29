import { AdminGate } from "@/components/admin/primitives";
import { UsageDashboard } from "@/components/admin/usage-dashboard";

/** Registered as `admin.usage` (P2.19.4). */
export default function AdminUsagePage() {
  return (
    <AdminGate permission="analytics:read">
      <UsageDashboard />
    </AdminGate>
  );
}
